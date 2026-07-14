import { FRIEND_ERROR_CODES } from '@yap/contracts';
import { createTestContext, expectErrorCode, type TestContext } from '../../test/helpers/app';
import { resetDb } from '../../test/helpers/db';
import { createUser } from '../../test/helpers/factories';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  let ctx: TestContext;
  let friends: FriendsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await createTestContext();
    friends = ctx.app.get(FriendsService);
    prisma = ctx.prisma;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  it('sends a pending outgoing request', async () => {
    const alice = await createUser(prisma);
    const bob = await createUser(prisma);
    const req = await friends.sendRequest(alice.id, bob.email);
    expect(req.direction).toBe('outgoing');
    expect(await friends.areFriends(alice.id, bob.id)).toBe(false);
  });

  it('auto-accepts when the target already requested the sender', async () => {
    const alice = await createUser(prisma);
    const bob = await createUser(prisma);
    await prisma.friendship.create({ data: { requesterId: bob.id, addresseeId: alice.id } });
    await friends.sendRequest(alice.id, bob.email);
    expect(await friends.areFriends(alice.id, bob.id)).toBe(true);
  });

  it('rejects a duplicate outgoing request', async () => {
    const alice = await createUser(prisma);
    const bob = await createUser(prisma);
    await friends.sendRequest(alice.id, bob.email);
    await expectErrorCode(
      friends.sendRequest(alice.id, bob.email),
      FRIEND_ERROR_CODES.friendRequestExists,
    );
  });

  it('rejects re-friending an existing friend', async () => {
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
    await expectErrorCode(
      friends.sendRequest(alice.id, bob.email),
      FRIEND_ERROR_CODES.alreadyFriends,
    );
  });

  it('rejects friending yourself', async () => {
    const alice = await createUser(prisma);
    await expectErrorCode(
      friends.sendRequest(alice.id, alice.email),
      FRIEND_ERROR_CODES.cannotFriendSelf,
    );
  });

  it('hides a blocked user behind the same not-found error', async () => {
    const alice = await createUser(prisma);
    const bob = await createUser(prisma);
    await prisma.block.create({ data: { blockerId: alice.id, blockedId: bob.id } });
    await expectErrorCode(
      friends.sendRequest(alice.id, bob.email),
      FRIEND_ERROR_CODES.friendshipNotFound,
    );
  });

  it('accepts an incoming request but not from the wrong user', async () => {
    const alice = await createUser(prisma);
    const bob = await createUser(prisma);
    const stranger = await createUser(prisma);
    const req = await prisma.friendship.create({
      data: { requesterId: alice.id, addresseeId: bob.id },
    });
    await expectErrorCode(
      friends.acceptRequest(stranger.id, req.id),
      FRIEND_ERROR_CODES.friendshipNotFound,
    );
    await friends.acceptRequest(bob.id, req.id);
    expect(await friends.areFriends(alice.id, bob.id)).toBe(true);
  });

  it('removes an existing friend', async () => {
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
    await friends.removeFriend(alice.id, bob.id);
    expect(await friends.areFriends(alice.id, bob.id)).toBe(false);
  });
});
