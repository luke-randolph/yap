import { USER_ERROR_CODES } from '@yap/contracts';
import { createTestContext, expectErrorCode, type TestContext } from '../../test/helpers/app';
import { resetDb } from '../../test/helpers/db';
import { createUser } from '../../test/helpers/factories';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let ctx: TestContext;
  let users: UsersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await createTestContext();
    users = ctx.app.get(UsersService);
    prisma = ctx.prisma;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  describe('blocking', () => {
    it('records the block and tears down the friendship', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      await prisma.friendship.create({
        data: {
          requesterId: alice.id,
          addresseeId: bob.id,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });
      await users.blockUser(alice.id, bob.id);
      expect(
        await prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: alice.id, blockedId: bob.id } },
        }),
      ).not.toBeNull();
      expect(await prisma.friendship.count()).toBe(0);
    });

    it('rejects blocking yourself', async () => {
      const alice = await createUser(prisma);
      await expectErrorCode(users.blockUser(alice.id, alice.id), USER_ERROR_CODES.cannotBlockSelf);
    });

    it('rejects blocking an unknown user', async () => {
      const alice = await createUser(prisma);
      await expectErrorCode(
        users.blockUser(alice.id, 'does-not-exist'),
        USER_ERROR_CODES.userNotFound,
      );
    });

    it('unblocks and lists blocked users', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      await users.blockUser(alice.id, bob.id);
      expect((await users.listBlocked(alice.id)).map((u) => u.id)).toContain(bob.id);
      await users.unblockUser(alice.id, bob.id);
      expect(await users.listBlocked(alice.id)).toHaveLength(0);
    });

    it('hides a blocked user from getProfile behind not-found', async () => {
      const alice = await createUser(prisma);
      const bob = await createUser(prisma);
      await users.blockUser(alice.id, bob.id);
      await expectErrorCode(users.getProfile(alice.id, bob.id), USER_ERROR_CODES.userNotFound);
    });
  });

  describe('search', () => {
    it('matches friends by partial name but strangers only by exact email', async () => {
      const me = await createUser(prisma);
      const friend = await createUser(prisma, { displayName: 'Alicia Keys' });
      const stranger = await createUser(prisma, { displayName: 'Alexander Stranger' });
      await prisma.friendship.create({
        data: {
          requesterId: me.id,
          addresseeId: friend.id,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });

      const byPartial = (await users.search(me.id, 'Ali')).map((u) => u.id);
      expect(byPartial).toContain(friend.id);
      expect(byPartial).not.toContain(stranger.id);

      const byExactEmail = (await users.search(me.id, stranger.email)).map((u) => u.id);
      expect(byExactEmail).toContain(stranger.id);
    });

    it('excludes blocked users from search', async () => {
      const me = await createUser(prisma);
      const blocked = await createUser(prisma);
      await users.blockUser(me.id, blocked.id);
      const results = (await users.search(me.id, blocked.email)).map((u) => u.id);
      expect(results).not.toContain(blocked.id);
    });
  });
});
