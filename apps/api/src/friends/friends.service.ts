import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FRIEND_ERROR_CODES, type FriendDTO, type FriendRequestDTO } from '@yap/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { userPublicSelect } from '../users/user.selects';

const friendshipInclude = {
  requester: { select: userPublicSelect },
  addressee: { select: userPublicSelect },
} satisfies Prisma.FriendshipInclude;

type FriendshipWithUsers = Prisma.FriendshipGetPayload<{ include: typeof friendshipInclude }>;

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFriends(userId: string): Promise<FriendDTO[]> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: friendshipInclude,
      orderBy: { acceptedAt: 'desc' },
    });
    return rows.map((row) => this.toFriendDTO(row, userId));
  }

  async listRequests(
    userId: string,
  ): Promise<{ incoming: FriendRequestDTO[]; outgoing: FriendRequestDTO[] }> {
    const rows = await this.prisma.friendship.findMany({
      where: {
        status: 'pending',
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: friendshipInclude,
      orderBy: { createdAt: 'desc' },
    });
    const incoming: FriendRequestDTO[] = [];
    const outgoing: FriendRequestDTO[] = [];
    for (const row of rows) {
      if (row.addresseeId === userId) incoming.push(this.toRequestDTO(row, 'incoming'));
      else outgoing.push(this.toRequestDTO(row, 'outgoing'));
    }
    return { incoming, outgoing };
  }

  // If the target has already requested the sender, the two are friended immediately.
  async sendRequest(userId: string, email: string): Promise<FriendRequestDTO> {
    const target = await this.resolveTarget(userId, email);

    const existing = await this.findBetween(userId, target.id);
    if (existing) {
      if (existing.status === 'accepted') {
        throw new BadRequestException({
          error: { code: FRIEND_ERROR_CODES.alreadyFriends, message: 'Already friends' },
        });
      }
      if (existing.addresseeId === userId) {
        const accepted = await this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'accepted', acceptedAt: new Date() },
          include: friendshipInclude,
        });
        return this.toRequestDTO(accepted, 'incoming');
      }
      throw new BadRequestException({
        error: { code: FRIEND_ERROR_CODES.friendRequestExists, message: 'Request already sent' },
      });
    }

    const created = await this.prisma.friendship.create({
      data: { requesterId: userId, addresseeId: target.id },
      include: friendshipInclude,
    });
    return this.toRequestDTO(created, 'outgoing');
  }

  async acceptRequest(userId: string, friendshipId: string): Promise<FriendRequestDTO> {
    const request = await this.prisma.friendship.findFirst({
      where: { id: friendshipId, addresseeId: userId, status: 'pending' },
    });
    if (!request) throw this.friendshipNotFound();
    const accepted = await this.prisma.friendship.update({
      where: { id: request.id },
      data: { status: 'accepted', acceptedAt: new Date() },
      include: friendshipInclude,
    });
    return this.toRequestDTO(accepted, 'incoming');
  }

  // Declines an incoming request or cancels an outgoing one.
  async declineRequest(userId: string, friendshipId: string): Promise<void> {
    const request = await this.prisma.friendship.findFirst({
      where: {
        id: friendshipId,
        status: 'pending',
        OR: [{ addresseeId: userId }, { requesterId: userId }],
      },
    });
    if (!request) throw this.friendshipNotFound();
    await this.prisma.friendship.delete({ where: { id: request.id } });
  }

  async removeFriend(userId: string, otherUserId: string): Promise<void> {
    const friendship = await this.findBetween(userId, otherUserId);
    if (!friendship || friendship.status !== 'accepted') throw this.friendshipNotFound();
    await this.prisma.friendship.delete({ where: { id: friendship.id } });
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const friendship = await this.findBetween(a, b);
    return friendship?.status === 'accepted';
  }

  private async findBetween(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  private async resolveTarget(userId: string, email: string): Promise<{ id: string }> {
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kind: true },
    });
    const requiredKind = me?.kind === 'guest' ? 'demo' : 'member';
    const target = await this.prisma.user.findFirst({
      where: { email, deletedAt: null, kind: requiredKind },
      select: { id: true },
    });
    if (target?.id === userId) {
      throw new BadRequestException({
        error: { code: FRIEND_ERROR_CODES.cannotFriendSelf, message: "You can't friend yourself" },
      });
    }
    // A missing user or a block in either direction is reported identically so
    // blocking stays private.
    if (!target || (await this.isBlockedEitherDirection(userId, target.id))) {
      throw new NotFoundException({
        error: { code: FRIEND_ERROR_CODES.friendshipNotFound, message: 'User not found' },
      });
    }
    return target;
  }

  async isBlockedEitherDirection(a: string, b: string): Promise<boolean> {
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: a, blockedId: b },
          { blockerId: b, blockedId: a },
        ],
      },
      select: { id: true },
    });
    return block !== null;
  }

  private friendshipNotFound(): NotFoundException {
    return new NotFoundException({
      error: { code: FRIEND_ERROR_CODES.friendshipNotFound, message: 'Friend request not found' },
    });
  }

  private toFriendDTO(row: FriendshipWithUsers, userId: string): FriendDTO {
    const other = row.requesterId === userId ? row.addressee : row.requester;
    return {
      friendshipId: row.id,
      user: other,
      friendsSince: (row.acceptedAt ?? row.updatedAt).toISOString(),
    };
  }

  private toRequestDTO(
    row: FriendshipWithUsers,
    direction: 'incoming' | 'outgoing',
  ): FriendRequestDTO {
    const other = direction === 'incoming' ? row.requester : row.addressee;
    return {
      id: row.id,
      direction,
      user: other,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
