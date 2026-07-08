import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  type FriendDTO,
  type FriendRequestDTO,
  type SendFriendRequestInput,
  sendFriendRequestSchema,
} from '@yap/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FriendsService } from './friends.service';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Get()
  list(@CurrentUser() current: AccessTokenPayload): Promise<FriendDTO[]> {
    return this.friends.listFriends(current.sub);
  }

  @Get('requests')
  requests(
    @CurrentUser() current: AccessTokenPayload,
  ): Promise<{ incoming: FriendRequestDTO[]; outgoing: FriendRequestDTO[] }> {
    return this.friends.listRequests(current.sub);
  }

  @Post('requests')
  send(
    @CurrentUser() current: AccessTokenPayload,
    @Body(new ZodValidationPipe(sendFriendRequestSchema)) body: SendFriendRequestInput,
  ): Promise<FriendRequestDTO> {
    return this.friends.sendRequest(current.sub, body.email);
  }

  @Post('requests/:id/accept')
  accept(
    @CurrentUser() current: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<FriendRequestDTO> {
    return this.friends.acceptRequest(current.sub, id);
  }

  @Post('requests/:id/decline')
  decline(@CurrentUser() current: AccessTokenPayload, @Param('id') id: string): Promise<void> {
    return this.friends.declineRequest(current.sub, id);
  }

  @Delete(':userId')
  remove(
    @CurrentUser() current: AccessTokenPayload,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.friends.removeFriend(current.sub, userId);
  }
}
