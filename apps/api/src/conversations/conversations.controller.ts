import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type ConversationDTO,
  type CreateConversationInput,
  type MessageDTO,
  type MessagesQueryInput,
  type SendMessageInput,
  createConversationSchema,
  messagesQuerySchema,
  sendMessageSchema,
} from '@yap/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard, type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MessagesService } from '../messages/messages.service';
import { ConversationParticipantGuard } from './conversation-participant.guard';
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

  @Get(':conversationId')
  @UseGuards(ConversationParticipantGuard)
  async findOne(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
  ): Promise<ConversationDTO> {
    return this.conversations.findById(current.sub, conversationId);
  }

  @Get(':conversationId/messages')
  @UseGuards(ConversationParticipantGuard)
  async listMessages(
    @Param('conversationId') conversationId: string,
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQueryInput,
  ): Promise<MessageDTO[]> {
    return this.messages.list(conversationId, query);
  }

  @Post(':conversationId/messages')
  @UseGuards(ConversationParticipantGuard)
  async sendMessage(
    @CurrentUser() current: AccessTokenPayload,
    @Param('conversationId') conversationId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ): Promise<MessageDTO> {
    return this.messages.create(current.sub, conversationId, body);
  }
}
