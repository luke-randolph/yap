import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  MESSAGE_IMAGE,
  type AddParticipantsInput,
  type ConversationDTO,
  type ConversationParticipantsDTO,
  type CreateConversationInput,
  type MessageDTO,
  type MessagesQueryInput,
  type ReactMessageInput,
  type SendImageMessageInput,
  type SendMessageInput,
  type UpdateConversationInput,
  addParticipantsSchema,
  createConversationSchema,
  messagesQuerySchema,
  reactMessageSchema,
  sendImageMessageSchema,
  sendMessageSchema,
  updateConversationSchema,
} from '@yap/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from './conversations.service';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  @Post()
  async create(
    @CurrentUser() current: AccessTokenPayload,
    @Body(new ZodValidationPipe(createConversationSchema)) body: CreateConversationInput,
  ): Promise<ConversationDTO> {
    return this.conversations.create(current.sub, body);
  }

  @Get()
  async list(@CurrentUser() current: AccessTokenPayload): Promise<ConversationDTO[]> {
    return this.conversations.listForUser(current.sub);
  }

  @Get('blocked')
  async listBlocked(@CurrentUser() current: AccessTokenPayload): Promise<ConversationDTO[]> {
    return this.conversations.listBlocked(current.sub);
  }

  @Patch(':conversationId')
  async update(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(updateConversationSchema)) body: UpdateConversationInput,
  ): Promise<ConversationDTO> {
    return this.conversations.update(current.sub, conversationId, body);
  }

  @Get(':conversationId')
  async findOne(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationDTO> {
    return this.conversations.findById(current.sub, conversationId);
  }

  @Post(':conversationId/markRead')
  @HttpCode(204)
  async markRead(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.markRead(current.sub, conversationId);
  }

  @Post(':conversationId/star')
  @HttpCode(204)
  async star(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.setStarred(current.sub, conversationId, true);
  }

  @Delete(':conversationId/star')
  @HttpCode(204)
  async unstar(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.setStarred(current.sub, conversationId, false);
  }

  @Get(':conversationId/participants')
  async participants(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationParticipantsDTO> {
    return this.conversations.getParticipants(current.sub, conversationId);
  }

  @Post(':conversationId/participants')
  async addParticipants(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(addParticipantsSchema)) body: AddParticipantsInput,
  ): Promise<ConversationDTO> {
    return this.conversations.addParticipants(current.sub, conversationId, body.participantEmails);
  }

  @Post(':conversationId/accept-request')
  async acceptRequest(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationDTO> {
    return this.conversations.acceptRequest(current.sub, conversationId);
  }

  @Post(':conversationId/decline-request')
  @HttpCode(204)
  async declineRequest(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.declineRequest(current.sub, conversationId);
  }

  @Post(':conversationId/leave')
  @HttpCode(204)
  async leave(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.leave(current.sub, conversationId);
  }

  @Post(':conversationId/block')
  @HttpCode(204)
  async block(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.block(current.sub, conversationId);
  }

  @Post(':conversationId/unblock')
  @HttpCode(204)
  async unblock(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<void> {
    await this.conversations.unblock(current.sub, conversationId);
  }

  @Get(':conversationId/messages')
  async listMessages(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQueryInput,
  ): Promise<MessageDTO[]> {
    return this.messages.list(current.sub, conversationId, query);
  }

  @Post(':conversationId/messages')
  async sendMessage(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ): Promise<MessageDTO> {
    return this.messages.create(current.sub, conversationId, body);
  }

  @Post(':conversationId/messages/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MESSAGE_IMAGE.maxUploadBytes } }))
  async sendImageMessage(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(sendImageMessageSchema)) body: SendImageMessageInput,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<MessageDTO> {
    if (!file) throw new BadRequestException('No image uploaded');
    return this.messages.createImageMessage(current.sub, conversationId, body, file);
  }

  @Get(':conversationId/messages/pinned')
  async listPinned(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<MessageDTO[]> {
    return this.messages.listPinned(current.sub, conversationId);
  }

  @Post(':conversationId/messages/:messageId/pin')
  async pin(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ): Promise<MessageDTO> {
    return this.messages.setPinned(current.sub, conversationId, messageId, true);
  }

  @Delete(':conversationId/messages/:messageId/pin')
  async unpin(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ): Promise<MessageDTO> {
    return this.messages.setPinned(current.sub, conversationId, messageId, false);
  }

  @Delete(':conversationId/messages/:messageId')
  @HttpCode(204)
  async deleteMessage(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    await this.messages.remove(current.sub, conversationId, messageId);
  }

  @Post(':conversationId/messages/:messageId/reactions')
  async react(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body(new ZodValidationPipe(reactMessageSchema)) body: ReactMessageInput,
  ): Promise<MessageDTO> {
    return this.messages.react(current.sub, conversationId, messageId, body.emoji);
  }

  @Delete(':conversationId/messages/:messageId/reactions')
  async unreact(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ): Promise<MessageDTO> {
    return this.messages.unreact(current.sub, conversationId, messageId);
  }
}
