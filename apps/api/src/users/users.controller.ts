import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import type { UserPublicDTO } from '@yap/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() current: AccessTokenPayload): Promise<UserPublicDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: current.sub },
      select: { id: true, email: true, displayName: true, avatarUrl: true, deletedAt: true },
    });
    if (!user || user.deletedAt) throw new NotFoundException();
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  }
}
