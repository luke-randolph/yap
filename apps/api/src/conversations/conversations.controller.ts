import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type ConversationDTO,
  type CreateConversationInput,
  type MessageDTO,
  type MessagesQueryInput,
  type ReactMessageInput,
  type SendMessageInput,
  type UpdateConversationInput,
  createConversationSchema,
  messagesQuerySchema,
  reactMessageSchema,
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
