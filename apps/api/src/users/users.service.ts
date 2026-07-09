import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AVATAR, USER_ERROR_CODES, type UserPublicDTO } from '@yap/contracts';
import sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type StorageAdapter } from '../storage/storage.interface';
import { userPublicSelect } from './user.selects';

const USER_SEARCH_LIMIT = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async findMe(userId: string): Promise<UserPublicDTO> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: userPublicSelect,
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateDisplayName(userId: string, displayName: string): Promise<UserPublicDTO> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { displayName },
      select: userPublicSelect,
    });
  }

  async setAvatarFromUpload(userId: string, file: Express.Multer.File): Promise<UserPublicDTO> {
    if (!AVATAR.allowedMimeTypes.some((t) => t === file.mimetype)) {
      throw new BadRequestException('Unsupported image type');
    }
    const processed = await sharp(file.buffer)
      .resize(AVATAR.outputSize, AVATAR.outputSize, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
    const key = `avatars/${userId}-${randomUUID()}.webp`;
    const url = await this.storage.put(key, processed, 'image/webp');
    return this.replaceAvatar(userId, url);
  }

  async removeAvatar(userId: string): Promise<UserPublicDTO> {
    return this.replaceAvatar(userId, null);
  }

  // Friends are matchable by partial name or email; anyone else only surfaces on
  // an exact email match, so strangers don't appear from casual typing.
  async search(currentUserId: string, q: string): Promise<UserPublicDTO[]> {
    const me = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { kind: true },
    });
    // Sandbox isolation: guests only ever see demo characters; real members
    // never see demo or guest accounts.
    const audienceKind = me?.kind === 'guest' ? 'demo' : 'member';
    const [friendIds, blockedIds] = await Promise.all([
      this.friendIds(currentUserId),
      this.blockedIds(currentUserId),
    ]);

    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: currentUserId, notIn: blockedIds },
        kind: audienceKind,
        OR: [
          {
            id: { in: friendIds },
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
          { email: { equals: q, mode: 'insensitive' } },
        ],
      },
      select: userPublicSelect,
      orderBy: { displayName: 'asc' },
      take: USER_SEARCH_LIMIT,
    });
  }

  async getProfile(currentUserId: string, targetId: string): Promise<UserPublicDTO> {
    const me = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { kind: true },
    });
    const audienceKind = me?.kind === 'guest' ? 'demo' : 'member';
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null, kind: audienceKind },
      select: userPublicSelect,
    });
    // A missing user or a block in either direction is reported identically so
    // blocking stays private.
    if (!target || (await this.blockedIds(currentUserId)).includes(targetId)) {
      throw new NotFoundException({
        error: { code: USER_ERROR_CODES.userNotFound, message: 'User not found' },
      });
    }
    return target;
  }

  // Blocking is mutual-effect: it also tears down any friendship or pending
  // request between the two.
  async blockUser(currentUserId: string, targetId: string): Promise<void> {
    if (targetId === currentUserId) {
      throw new BadRequestException({
        error: { code: USER_ERROR_CODES.cannotBlockSelf, message: "You can't block yourself" },
      });
    }
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, deletedAt: null },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException({
        error: { code: USER_ERROR_CODES.userNotFound, message: 'User not found' },
      });
    }
    await this.prisma.$transaction([
      this.prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: currentUserId, blockedId: targetId } },
        create: { blockerId: currentUserId, blockedId: targetId },
        update: {},
      }),
      this.prisma.friendship.deleteMany({
        where: {
          OR: [
            { requesterId: currentUserId, addresseeId: targetId },
            { requesterId: targetId, addresseeId: currentUserId },
          ],
        },
      }),
    ]);
  }

  async unblockUser(currentUserId: string, targetId: string): Promise<void> {
    await this.prisma.block.deleteMany({
      where: { blockerId: currentUserId, blockedId: targetId },
    });
  }

  async listBlocked(currentUserId: string): Promise<UserPublicDTO[]> {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: currentUserId },
      select: { blocked: { select: userPublicSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => row.blocked);
  }

  private async friendIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'accepted', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
  }

  private async blockedIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    return rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId));
  }

  // Updates avatarUrl and best-effort deletes the previously stored object.
  private async replaceAvatar(userId: string, url: string | null): Promise<UserPublicDTO> {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
      select: userPublicSelect,
    });
    if (existing?.avatarUrl) {
      const oldKey = this.storage.keyFromUrl(existing.avatarUrl);
      if (oldKey) void this.storage.delete(oldKey).catch(() => undefined);
    }
    return user;
  }
}
