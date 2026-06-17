import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import {
  CONVERSATION_ERROR_CODES,
  type ConversationDTO,
  type CreateConversationInput,
  type ParticipantDTO,
  type UpdateConversationInput,
} from '@yap/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  REALTIME_EVENTS,
  type ConversationCreatedEvent,
  type ConversationUpdatedEvent,
} from '../realtime/realtime.events';
import { userPublicSelect } from '../users/user.selects';

const conversationInclude = {
  participants: {
    where: { leftAt: null },
    include: { user: { select: userPublicSelect } },
  },
} satisfies Prisma.ConversationInclude;

type ConversationWithParticipants = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    currentUserId: string,
    input: CreateConversationInput,
  ): Promise<ConversationDTO> {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: currentUserId },
      select: { id: true, email: true },
    });

    const dedupedEmails = Array.from(new Set(input.participantEmails));
    const otherEmails = dedupedEmails.filter((email) => email !== me.email);
    if (otherEmails.length === 0) {
      throw new BadRequestException(unknownEmailsError(['(no recipients)']));
    }

    const others = await this.prisma.user.findMany({
      where: { email: { in: otherEmails }, deletedAt: null },
      select: { id: true, email: true },
    });
    const foundEmails = new Set(others.map((u) => u.email));
    const missing = otherEmails.filter((email) => !foundEmails.has(email));
    if (missing.length) throw new BadRequestException(unknownEmailsError(missing));

    const otherIds = others.map((u) => u.id);
    const isGroup = otherIds.length > 1;

    if (!isGroup) {
      const existing = await this.findExistingDm(currentUserId, otherIds[0]);
      if (existing) return this.toDto(existing, currentUserId);
    }

    const created = await this.prisma.conversation.create({
      data: {
        isGroup,
        name: isGroup ? input.name ?? null : null,
        createdById: currentUserId,
        participants: {
          create: [me.id, ...otherIds].map((userId) => ({
            userId,
            isAdmin: isGroup && userId === currentUserId,
          })),
        },
      },
      include: conversationInclude,
    });

    const { actorDto, byUserId } = this.perUserDtos(created, currentUserId);
    const event: ConversationCreatedEvent = { conversationByUserId: byUserId };
    this.events.emit(REALTIME_EVENTS.conversationCreated, event);
    return actorDto;
  }

  async update(
    currentUserId: string,
    conversationId: string,
    input: UpdateConversationInput,
  ): Promise<ConversationDTO> {
    await this.assertParticipant(currentUserId, conversationId);

    const existing = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true },
    });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: CONVERSATION_ERROR_CODES.conversationNotFound,
          message: 'Conversation not found',
        },
      });
    }
    if (!existing.isGroup) {
      throw new BadRequestException({
        error: {
          code: CONVERSATION_ERROR_CODES.notGroupConversation,
          message: 'Only group conversations can be renamed',
        },
      });
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { name: input.name },
      include: conversationInclude,
    });

    const { actorDto, byUserId } = this.perUserDtos(updated, currentUserId);
    const event: ConversationUpdatedEvent = { conversationByUserId: byUserId };
    this.events.emit(REALTIME_EVENTS.conversationUpdated, event);
    return actorDto;
  }

  async listForUser(currentUserId: string): Promise<ConversationDTO[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: currentUserId, leftAt: null } } },
      include: conversationInclude,
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    return rows.map((row) => this.toDto(row, currentUserId));
  }

  async findById(currentUserId: string, conversationId: string): Promise<ConversationDTO> {
    await this.assertParticipant(currentUserId, conversationId);
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (!row) {
      throw new NotFoundException({
        error: {
          code: CONVERSATION_ERROR_CODES.conversationNotFound,
          message: 'Conversation not found',
        },
      });
    }
    return this.toDto(row, currentUserId);
  }

  async assertParticipant(userId: string, conversationId: string): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { leftAt: true },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException({
        error: {
          code: CONVERSATION_ERROR_CODES.notParticipant,
          message: 'Not a participant in this conversation',
        },
      });
    }
  }

  private async findExistingDm(
    userIdA: string,
    userIdB: string,
  ): Promise<ConversationWithParticipants | null> {
    return this.prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: userIdA, leftAt: null } } },
          { participants: { some: { userId: userIdB, leftAt: null } } },
        ],
      },
      include: conversationInclude,
    });
  }

  /**
   * Builds the per-recipient DTO map for a realtime broadcast (displayName is
   * computed per viewer) and returns the actor's own DTO alongside it.
   */
  private perUserDtos(
    row: ConversationWithParticipants,
    actorUserId: string,
  ): { actorDto: ConversationDTO; byUserId: Map<string, ConversationDTO> } {
    const actorDto = this.toDto(row, actorUserId);
    const byUserId = new Map<string, ConversationDTO>();
    for (const p of row.participants) {
      byUserId.set(
        p.userId,
        p.userId === actorUserId ? actorDto : this.toDto(row, p.userId),
      );
    }
    return { actorDto, byUserId };
  }

  private toDto(
    row: ConversationWithParticipants,
    currentUserId: string,
  ): ConversationDTO {
    const participants: ParticipantDTO[] = row.participants.map((p) => ({
      user: p.user,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt?.toISOString() ?? null,
      lastReadMessageId: p.lastReadMessageId,
      isAdmin: p.isAdmin,
    }));

    return {
      id: row.id,
      isGroup: row.isGroup,
      name: row.name,
      displayName: computeDisplayName(row, participants, currentUserId),
      participants,
      lastMessageAt: row.lastMessageAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function computeDisplayName(
  row: { isGroup: boolean; name: string | null },
  participants: ParticipantDTO[],
  currentUserId: string,
): string {
  if (row.name) return row.name;
  const others = participants.filter((p) => p.user.id !== currentUserId);
  if (!row.isGroup) return others[0]?.user.displayName ?? 'Direct message';
  return others.map((p) => p.user.displayName).join(', ') || 'Group';
}

function unknownEmailsError(missing: string[]) {
  return {
    error: {
      code: CONVERSATION_ERROR_CODES.unknownEmails,
      message: `Unknown emails: ${missing.join(', ')}`,
      details: { unknownEmails: missing },
    },
  };
}
