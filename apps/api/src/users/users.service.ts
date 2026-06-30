import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AVATAR, type UserPublicDTO } from '@yap/contracts';
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

  async search(currentUserId: string, q: string): Promise<UserPublicDTO[]> {
    const me = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { kind: true },
    });
    // Sandbox isolation: guests only ever see demo characters; real members
    // never see demo or guest accounts.
    const audienceKind = me?.kind === 'guest' ? 'demo' : 'member';

    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: currentUserId },
        kind: audienceKind,
        OR: [
          { displayName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: userPublicSelect,
      orderBy: { displayName: 'asc' },
      take: USER_SEARCH_LIMIT,
    });
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
