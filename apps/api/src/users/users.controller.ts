import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AVATAR,
  type UpdateUserInput,
  type UserPublicDTO,
  type UserSearchQueryInput,
  updateUserSchema,
  userSearchQuerySchema,
} from '@yap/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() current: AccessTokenPayload): Promise<UserPublicDTO> {
    return this.users.findMe(current.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() current: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ): Promise<UserPublicDTO> {
    return this.users.updateDisplayName(current.sub, body.displayName);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR.maxUploadBytes } }))
  uploadAvatar(
    @CurrentUser() current: AccessTokenPayload,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UserPublicDTO> {
    if (!file) throw new BadRequestException('No image uploaded');
    return this.users.setAvatarFromUpload(current.sub, file);
  }

  @Delete('me/avatar')
  deleteAvatar(@CurrentUser() current: AccessTokenPayload): Promise<UserPublicDTO> {
    return this.users.removeAvatar(current.sub);
  }

  @Get('search')
  search(
    @CurrentUser() current: AccessTokenPayload,
    @Query(new ZodValidationPipe(userSearchQuerySchema)) query: UserSearchQueryInput,
  ): Promise<UserPublicDTO[]> {
    return this.users.search(current.sub, query.q);
  }
}
