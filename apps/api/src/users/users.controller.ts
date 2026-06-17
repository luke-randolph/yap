import { Body, Controller, Get, NotFoundException, Patch, Query, UseGuards } from '@nestjs/common';
import {
  type UpdateUserInput,
  type UserPublicDTO,
  type UserSearchQueryInput,
  updateUserSchema,
  userSearchQuerySchema,
} from '@yap/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { userPublicSelect } from './user.selects';

const USER_SEARCH_LIMIT = 10;

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentUser() current: AccessTokenPayload): Promise<UserPublicDTO> {
    const user = await this.prisma.user.findFirst({
      where: { id: current.sub, deletedAt: null },
      select: userPublicSelect,
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() current: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ): Promise<UserPublicDTO> {
    return this.prisma.user.update({
      where: { id: current.sub },
      data: { displayName: body.displayName },
      select: userPublicSelect,
    });
  }

  @Get('search')
  async search(
    @CurrentUser() current: AccessTokenPayload,
    @Query(new ZodValidationPipe(userSearchQuerySchema)) query: UserSearchQueryInput,
  ): Promise<UserPublicDTO[]> {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: current.sub },
        OR: [
          { displayName: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
        ],
      },
      select: userPublicSelect,
      orderBy: { displayName: 'asc' },
      take: USER_SEARCH_LIMIT,
    });
  }
}
