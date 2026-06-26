import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  CONVERSATION_ERROR_CODES,
  MESSAGE_IMAGE,
  type MessageDTO,
  type MessagesQueryInput,
  type SendImageMessageInput,
  type SendMessageInput,
} from '@yap/contracts';
import sharp from 'sharp';
import { ConversationsService } from '../conversations/conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, type StorageAdapter } from '../storage/storage.interface';
import {
  REALTIME_EVENTS,
  type MessageCreatedEvent,
  type MessageUpdatedEvent,
} from '../realtime/realtime.events';

const messageInclude = {
  attachments: true,
  reactions: true,
} satisfies Prisma.MessageInclude;

type MessageWithRelations = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

interface AttachmentData {
  url: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly conversations: ConversationsService,
    @Inject(STORAGE) private readonly storage: StorageAdapter,
  ) {}

  async list(
    currentUserId: string,
    conversationId: string,
    query: MessagesQueryInput,
  ): Promise<MessageDTO[]> {
    await this.conversations.assertParticipant(currentUserId, conversationId);
    const direction: 'before' | 'after' = query.after ? 'after' : 'before';
    const cursorId = query.after ?? query.before;
    const cursor = await this.resolveCursor(conversationId, cursorId);

    const where: Prisma.MessageWhereInput = { conversationId, deletedAt: null };
    if (cursor) {
      where.OR =
        direction === 'before'
          ? [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ]
          : [
              { createdAt: { gt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { gt: cursor.id } },
            ];
    }

    const orderBy: Prisma.MessageOrderByWithRelationInput[] =
      direction === 'after'
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }];

    const rows = await this.prisma.message.findMany({
      where,
      include: messageInclude,
      orderBy,
      take: query.limit,
    });

    return rows.map(toMessageDto);
  }

  async create(
    senderId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<MessageDTO> {
    return this.persistMessage(senderId, conversationId, input, []);
  }

  async createImageMessage(
    senderId: string,
    conversationId: string,
    input: SendImageMessageInput,
    file: Express.Multer.File,
  ): Promise<MessageDTO> {
    if (!MESSAGE_IMAGE.allowedMimeTypes.some((t) => t === file.mimetype)) {
      throw new BadRequestException('Unsupported image type');
    }
    const { data, info } = await sharp(file.buffer)
      .rotate()
      .resize(MESSAGE_IMAGE.maxDimension, MESSAGE_IMAGE.maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const key = `messages/${conversationId}/${randomUUID()}.webp`;
    const url = await this.storage.put(key, data, 'image/webp');
    const attachment: AttachmentData = {
      url,
      mimeType: 'image/webp',
      width: info.width,
      height: info.height,
      sizeBytes: info.size,
    };
    return this.persistMessage(
      senderId,
      conversationId,
      { body: input.body || null, parentMessageId: input.parentMessageId, clientMessageId: input.clientMessageId },
      [attachment],
    );
  }

  private async persistMessage(
    senderId: string,
    conversationId: string,
    input: {
      body?: string | null;
      parentMessageId?: string;
      clientMessageId: string;
    },
    attachments: AttachmentData[],
  ): Promise<MessageDTO> {
    // Fetch active participants once: this both gates the send (sender must be a
    // member) and supplies the recipient list for the realtime broadcast below.
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, leftAt: null },
      select: { userId: true },
    });
    if (!participants.some((p) => p.userId === senderId)) {
      throw new ForbiddenException({
        error: {
          code: CONVERSATION_ERROR_CODES.notParticipant,
          message: 'Not a participant in this conversation',
        },
      });
    }

    if (input.parentMessageId) {
      const parent = await this.prisma.message.findFirst({
        where: { id: input.parentMessageId, conversationId },
        select: { id: true },
      });
      if (!parent) {
        throw new BadRequestException({
          error: {
            code: CONVERSATION_ERROR_CODES.parentMessageNotFound,
            message: 'Parent message not found in this conversation',
          },
        });
      }
    }

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          body: input.body ?? null,
          parentMessageId: input.parentMessageId ?? null,
          attachments: attachments.length ? { create: attachments } : undefined,
        },
        include: messageInclude,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastActivityAt: now },
      }),
    ]);

    const dto = toMessageDto(message);
    const event: MessageCreatedEvent = {
      message: dto,
      participantUserIds: participants.map((p) => p.userId),
      clientMessageId: input.clientMessageId,
    };
    this.events.emit(REALTIME_EVENTS.messageCreated, event);
    return dto;
  }

  async react(
    userId: string,
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<MessageDTO> {
    await this.conversations.assertParticipant(userId, conversationId);
    await this.assertMessageInConversation(messageId, conversationId);

    // One reaction per user per message: clear any existing one, then set the new.
    await this.prisma.$transaction([
      this.prisma.messageReaction.deleteMany({ where: { messageId, userId } }),
      this.prisma.messageReaction.create({ data: { messageId, userId, emoji } }),
    ]);

    return this.emitMessageUpdate(conversationId, messageId);
  }

  async unreact(userId: string, conversationId: string, messageId: string): Promise<MessageDTO> {
    await this.conversations.assertParticipant(userId, conversationId);
    await this.assertMessageInConversation(messageId, conversationId);

    await this.prisma.messageReaction.deleteMany({ where: { messageId, userId } });

    return this.emitMessageUpdate(conversationId, messageId);
  }

  private async assertMessageInConversation(
    messageId: string,
    conversationId: string,
  ): Promise<void> {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, deletedAt: null },
      select: { id: true },
    });
    if (!message) {
      throw new BadRequestException({
        error: {
          code: CONVERSATION_ERROR_CODES.messageNotFound,
          message: 'Message not found in this conversation',
        },
      });
    }
  }

  private async emitMessageUpdate(conversationId: string, messageId: string): Promise<MessageDTO> {
    const [message, participants] = await Promise.all([
      this.prisma.message.findUniqueOrThrow({
        where: { id: messageId },
        include: messageInclude,
      }),
      this.prisma.conversationParticipant.findMany({
        where: { conversationId, leftAt: null },
        select: { userId: true },
      }),
    ]);

    const dto = toMessageDto(message);
    const event: MessageUpdatedEvent = {
      message: dto,
      participantUserIds: participants.map((p) => p.userId),
    };
    this.events.emit(REALTIME_EVENTS.messageUpdated, event);
    return dto;
  }

  private async resolveCursor(
    conversationId: string,
    cursorId: string | undefined,
  ): Promise<{ id: string; createdAt: Date } | null> {
    if (!cursorId) return null;
    const cursor = await this.prisma.message.findFirst({
      where: { id: cursorId, conversationId },
      select: { id: true, createdAt: true },
    });
    return cursor ?? null;
  }
}

function toMessageDto(row: MessageWithRelations): MessageDTO {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderId: row.senderId,
    body: row.body,
    parentMessageId: row.parentMessageId,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      url: a.url,
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      sizeBytes: a.sizeBytes,
    })),
    reactions: row.reactions.map((r) => ({
      userId: r.userId,
      emoji: r.emoji,
      createdAt: r.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}
