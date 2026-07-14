import { CONVERSATION_ERROR_CODES } from '@yap/contracts';
import { createTestContext, expectErrorCode, type TestContext } from '../../test/helpers/app';
import { resetDb } from '../../test/helpers/db';
import { createUser } from '../../test/helpers/factories';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from './conversations.service';

describe('ConversationsService', () => {
  let ctx: TestContext;
  let convos: ConversationsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await createTestContext();
    convos = ctx.app.get(ConversationsService);
    prisma = ctx.prisma;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function befriend(a: string, b: string) {
    await prisma.friendship.create({
      data: { requesterId: a, addresseeId: b, status: 'accepted', acceptedAt: new Date() },
    });
  }

  describe('create', () => {
    it('opens a DM to a non-friend as a pending request', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      const dto = await convos.create(alice.id, { participantEmails: [bob.email] });
      expect(dto.isGroup).toBe(false);
      expect(dto.requestState).toBe('outgoing');
      // The recipient sees it as an incoming request.
      const asBob = await convos.findById(bob.id, dto.id);
      expect(asBob.requestState).toBe('incoming');
    });

    it('opens a DM between friends with no request gate', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      await befriend(alice.id, bob.id);
      const dto = await convos.create(alice.id, { participantEmails: [bob.email] });
      expect(dto.requestState).toBe('none');
    });

    it('rejects unknown recipient emails', async () => {
      const alice = await createUser(prisma);
      await expectErrorCode(
        convos.create(alice.id, { participantEmails: ['nobody@example.com'] }),
        CONVERSATION_ERROR_CODES.unknownEmails,
      );
    });

    it('returns the existing DM instead of duplicating it', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      const first = await convos.create(alice.id, { participantEmails: [bob.email] });
      const second = await convos.create(alice.id, { participantEmails: [bob.email] });
      expect(second.id).toBe(first.id);
      expect(await prisma.conversation.count()).toBe(1);
    });
  });

  describe('access control', () => {
    it('forbids a non-participant from reading a conversation', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      const stranger = await createUser(prisma);
      const dto = await convos.create(alice.id, { participantEmails: [bob.email] });
      await expectErrorCode(
        convos.findById(stranger.id, dto.id),
        CONVERSATION_ERROR_CODES.notParticipant,
      );
    });
  });

  describe('message requests', () => {
    it('lets the recipient accept a pending request', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      const dto = await convos.create(alice.id, { participantEmails: [bob.email] });
      const accepted = await convos.acceptRequest(bob.id, dto.id);
      expect(accepted.requestState).toBe('none');
    });

    it('does not let the sender accept their own request', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      const dto = await convos.create(alice.id, { participantEmails: [bob.email] });
      await expectErrorCode(
        convos.acceptRequest(alice.id, dto.id),
        CONVERSATION_ERROR_CODES.notRequest,
      );
    });
  });

  describe('leave', () => {
    it('removes the participant and blocks further access', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      const dto = await convos.create(alice.id, { participantEmails: [bob.email] });
      await convos.leave(alice.id, dto.id);
      await expectErrorCode(
        convos.findById(alice.id, dto.id),
        CONVERSATION_ERROR_CODES.notParticipant,
      );
    });
  });
});
