import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, type UserKind } from '@prisma/client';
import {
  CONVERSATION_ERROR_CODES,
  type ConversationDTO,
  type ConversationParticipantsDTO,
  type CreateConversationInput,
  type MessageDTO,
  type ParticipantDTO,
  type UpdateConversationInput,
} from '@yap/contracts';
import { EmailService } from '../email/email.service';
import { FriendsService } from '../friends/friends.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  REALTIME_EVENTS,
  type ConversationCreatedEvent,
  type ConversationRemovedEvent,
  type ConversationUpdatedEvent,
  type MessageCreatedEvent,
} from '../realtime/realtime.events';
import { userPublicSelect } from '../users/user.selects';

const conversationInclude = {
  participants: {
    where: { leftAt: null },
    include: { user: { select: userPublicSelect } },
  },
  messages: {
    where: { deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
    select: { id: true, senderId: true },
  },
} satisfies Prisma.ConversationInclude;

type ConversationWithParticipants = Prisma.ConversationGetPayload<{
  include: typeof conversationInclude;
}>;

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly email: EmailService,
    private readonly friends: FriendsService,
  ) {}

  async create(currentUserId: string, input: CreateConversationInput): Promise<ConversationDTO> {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: currentUserId },
      select: { id: true, email: true, kind: true },
    });

    const dedupedEmails = Array.from(new Set(input.participantEmails));
    const otherEmails = dedupedEmails.filter((email) => email !== currentUser.email);
    if (otherEmails.length === 0) {
      throw new BadRequestException(unknownEmailsError(['(no recipients)']));
    }

    const others = await this.prisma.user.findMany({
      where: { email: { in: otherEmails }, deletedAt: null },
      select: { id: true, email: true, kind: true },
    });
    const foundEmails = new Set(others.map((u) => u.email));
    const missing = otherEmails.filter((email) => !foundEmails.has(email));
    if (missing.length) throw new BadRequestException(unknownEmailsError(missing));

    assertRecipientsAllowed(currentUser.kind, others);

    for (const other of others) {
      if (await this.friends.isBlockedEitherDirection(currentUserId, other.id)) {
        throw new ForbiddenException({
          error: {
            code: CONVERSATION_ERROR_CODES.recipientsNotAllowed,
            message: 'This person is not available.',
          },
        });
      }
    }

    const otherIds = others.map((u) => u.id);
    const isGroup = otherIds.length > 1;

    if (!isGroup) {
      const existing = await this.findExistingDm(currentUserId, otherIds[0]);
      if (existing) return this.toDto(existing, currentUserId);
    }

    const isRequest = !isGroup && !(await this.friends.areFriends(currentUserId, otherIds[0]));

    const created = await this.prisma.conversation.create({
      data: {
        isGroup,
        name: isGroup ? (input.name ?? null) : null,
        createdById: currentUserId,
        requestPending: isRequest,
        participants: {
          create: [currentUser.id, ...otherIds].map((userId) => ({ userId })),
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

  async addParticipants(
    currentUserId: string,
    conversationId: string,
    emails: string[],
  ): Promise<ConversationDTO> {
    await this.assertParticipant(currentUserId, conversationId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true },
    });
    if (!conversation) {
      throw new NotFoundException({
        error: {
          code: CONVERSATION_ERROR_CODES.conversationNotFound,
          message: 'Conversation not found',
        },
      });
    }
    if (!conversation.isGroup) {
      throw new BadRequestException({
        error: {
          code: CONVERSATION_ERROR_CODES.notGroupConversation,
          message: 'Only group conversations can have participants added',
        },
      });
    }

    const deduped = Array.from(new Set(emails));
    const users = await this.prisma.user.findMany({
      where: { email: { in: deduped }, deletedAt: null },
      select: { id: true, email: true, displayName: true, kind: true },
    });
    const foundEmails = new Set(users.map((u) => u.email));
    const missing = deduped.filter((email) => !foundEmails.has(email));
    if (missing.length) throw new BadRequestException(unknownEmailsError(missing));

    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: currentUserId },
      select: { kind: true, displayName: true },
    });
    assertRecipientsAllowed(me.kind, users);

    const existing = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { in: users.map((u) => u.id) } },
      select: { userId: true, leftAt: true, blockedAt: true },
    });
    const existingByUserId = new Map(existing.map((p) => [p.userId, p]));

    const blocked = users.filter((u) => existingByUserId.get(u.id)?.blockedAt);
    if (blocked.length) {
      throw new BadRequestException(participantsBlockedError(blocked.map((u) => u.email)));
    }

    const toAdd = users.filter((u) => {
      const p = existingByUserId.get(u.id);
      return !p || p.leftAt;
    });
    if (toAdd.length) {
      await this.prisma.$transaction(
        toAdd.map((u) =>
          this.prisma.conversationParticipant.upsert({
            where: { conversationId_userId: { conversationId, userId: u.id } },
            create: { conversationId, userId: u.id },
            update: {
              leftAt: null,
              blockedAt: null,
              joinedAt: new Date(),
              lastReadMessageId: null,
            },
          }),
        ),
      );
    }

    const row = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    const { actorDto, byUserId } = this.perUserDtos(row, currentUserId);
    this.events.emit(REALTIME_EVENTS.conversationUpdated, { conversationByUserId: byUserId });

    // After the roster update so freshly-added users already have the
    // conversation when the join notice arrives.
    for (const u of toAdd) {
      await this.postSystemMessage(conversationId, u.id, `${u.displayName} joined the group`);

      if (u.kind === 'member') {
        void this.email
          .sendAddedToGroup({
            to: u.email,
            displayName: u.displayName,
            groupName: row.name,
            addedByName: me.displayName,
          })
          .catch((err: Error) =>
            this.logger.error(`Failed to send add-to-group email to ${u.email}: ${err.message}`),
          );
      }
    }
    return actorDto;
  }

  async leave(currentUserId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(currentUserId, conversationId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { leftAt: new Date(), isStarred: false },
    });
    await this.announceDeparture(currentUserId, conversationId);
  }

  async block(currentUserId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(currentUserId, conversationId);
    const now = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { leftAt: now, blockedAt: now, isStarred: false },
    });
    // Same notice as leaving; blocking is private and shouldn't be revealed.
    await this.announceDeparture(currentUserId, conversationId);
  }

  async acceptRequest(currentUserId: string, conversationId: string): Promise<ConversationDTO> {
    await this.assertParticipant(currentUserId, conversationId);
    await this.assertRecipientOfPendingRequest(currentUserId, conversationId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { requestPending: false },
    });
    const row = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
    const { actorDto, byUserId } = this.perUserDtos(row, currentUserId);
    this.events.emit(REALTIME_EVENTS.conversationUpdated, { conversationByUserId: byUserId });
    return actorDto;
  }

  // Declining a message request leaves the DM; the sender keeps their copy, and
  // messaging again creates a fresh request.
  async declineRequest(currentUserId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(currentUserId, conversationId);
    await this.assertRecipientOfPendingRequest(currentUserId, conversationId);
    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { requestPending: false },
      }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: currentUserId } },
        data: { leftAt: new Date(), isStarred: false },
      }),
    ]);
    await this.emitDeparture(conversationId, currentUserId);
  }

  private async assertRecipientOfPendingRequest(
    currentUserId: string,
    conversationId: string,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { requestPending: true, createdById: true },
    });
    if (!conversation?.requestPending || conversation.createdById === currentUserId) {
      throw new BadRequestException({
        error: {
          code: CONVERSATION_ERROR_CODES.notRequest,
          message: 'Conversation is not a pending request',
        },
      });
    }
  }

  private async announceDeparture(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true },
    });
    if (conversation?.isGroup) {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { displayName: true },
      });
      await this.postSystemMessage(conversationId, userId, `${user.displayName} left the group`);
    }
    await this.emitDeparture(conversationId, userId);
  }

  async unblock(currentUserId: string, conversationId: string): Promise<void> {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      select: { blockedAt: true },
    });
    if (!participant?.blockedAt) {
      throw new BadRequestException({
        error: {
          code: CONVERSATION_ERROR_CODES.notBlocked,
          message: 'Conversation is not blocked',
        },
      });
    }
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { blockedAt: null },
    });
  }

  async assertCanSendDm(senderId: string, conversationId: string): Promise<void> {
    const convo = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { isGroup: true, participants: { select: { userId: true } } },
    });
    if (!convo || convo.isGroup) return;
    const other = convo.participants.find((p) => p.userId !== senderId);
    if (other && (await this.friends.isBlockedEitherDirection(senderId, other.userId))) {
      throw new ForbiddenException({
        error: {
          code: CONVERSATION_ERROR_CODES.recipientsNotAllowed,
          message: 'This person is not available.',
        },
      });
    }
  }

  async blockDms(blockerId: string, blockedId: string): Promise<void> {
    await this.setDmBlock(blockerId, blockedId, { userId: blockerId, leftAt: null }, new Date());
  }

  async unblockDms(blockerId: string, blockedId: string): Promise<void> {
    await this.setDmBlock(
      blockerId,
      blockedId,
      { userId: blockerId, blockedAt: { not: null } },
      null,
    );
  }

  private async setDmBlock(
    blockerId: string,
    blockedId: string,
    match: Prisma.ConversationParticipantWhereInput,
    blockedAt: Date | null,
  ): Promise<void> {
    const dms = await this.prisma.conversation.findMany({
      where: {
        isGroup: false,
        AND: [{ participants: { some: match } }, { participants: { some: { userId: blockedId } } }],
      },
      select: { id: true },
    });
    if (!dms.length) return;
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId: { in: dms.map((d) => d.id) }, userId: blockerId },
      data: blockedAt ? { blockedAt, isStarred: false } : { blockedAt: null },
    });
    for (const dm of dms) await this.emitConversationUpdated(dm.id, blockerId);
  }

  private async emitConversationUpdated(
    conversationId: string,
    actorUserId: string,
  ): Promise<void> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (!row) return;
    const { byUserId } = this.perUserDtos(row, actorUserId);
    const event: ConversationUpdatedEvent = { conversationByUserId: byUserId };
    this.events.emit(REALTIME_EVENTS.conversationUpdated, event);
  }

  async getParticipants(
    currentUserId: string,
    conversationId: string,
  ): Promise<ConversationParticipantsDTO> {
    await this.assertParticipant(currentUserId, conversationId);
    const rows = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      include: { user: { select: userPublicSelect } },
      orderBy: { joinedAt: 'asc' },
    });
    const toDto = (p: (typeof rows)[number]): ParticipantDTO => ({
      user: p.user,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt?.toISOString() ?? null,
      lastReadMessageId: p.lastReadMessageId,
    });
    return {
      active: rows.filter((p) => !p.leftAt).map(toDto),
      former: rows.filter((p) => p.leftAt && !p.blockedAt).map(toDto),
    };
  }

  async listBlocked(currentUserId: string): Promise<ConversationDTO[]> {
    const rows = await this.prisma.conversation.findMany({
      where: {
        isGroup: true,
        participants: { some: { userId: currentUserId, blockedAt: { not: null } } },
      },
      include: conversationInclude,
      orderBy: [{ lastActivityAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return rows.map((row) => this.toDto(row, currentUserId));
  }

  // Tells remaining members the roster shrank and tells the departed viewer to drop it.
  private async emitDeparture(conversationId: string, departedUserId: string): Promise<void> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (row && row.participants.length) {
      const byUserId = new Map<string, ConversationDTO>();
      for (const p of row.participants) byUserId.set(p.userId, this.toDto(row, p.userId));
      this.events.emit(REALTIME_EVENTS.conversationUpdated, { conversationByUserId: byUserId });
    }
    const removed: ConversationRemovedEvent = { conversationId, userIds: [departedUserId] };
    this.events.emit(REALTIME_EVENTS.conversationRemoved, removed);
  }

  async postSystemMessage(
    conversationId: string,
    subjectUserId: string,
    text: string,
  ): Promise<void> {
    const now = new Date();
    const [message, , participants] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: subjectUserId, type: 'system', body: text },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastActivityAt: now },
      }),
      this.prisma.conversationParticipant.findMany({
        where: { conversationId, leftAt: null },
        select: { userId: true },
      }),
    ]);

    const dto: MessageDTO = {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: 'system',
      body: message.body,
      parentMessageId: message.parentMessageId,
      attachments: [],
      reactions: [],
      createdAt: message.createdAt.toISOString(),
      editedAt: message.editedAt?.toISOString() ?? null,
      deletedAt: message.deletedAt?.toISOString() ?? null,
      pinnedAt: message.pinnedAt?.toISOString() ?? null,
    };
    const event: MessageCreatedEvent = {
      message: dto,
      participantUserIds: participants.map((p) => p.userId),
    };
    this.events.emit(REALTIME_EVENTS.messageCreated, event);
  }

  async listForUser(currentUserId: string): Promise<ConversationDTO[]> {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId: currentUserId, leftAt: null } } },
      include: conversationInclude,
      orderBy: [{ lastActivityAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    });
    return rows
      .map((row) => this.toDto(row, currentUserId))
      .sort((a, b) => Number(b.isStarred) - Number(a.isStarred));
  }

  async setStarred(currentUserId: string, conversationId: string, starred: boolean): Promise<void> {
    await this.assertParticipant(currentUserId, conversationId);
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { isStarred: starred },
    });
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
      byUserId.set(p.userId, p.userId === actorUserId ? actorDto : this.toDto(row, p.userId));
    }
    return { actorDto, byUserId };
  }

  async markRead(currentUserId: string, conversationId: string): Promise<void> {
    await this.assertParticipant(currentUserId, conversationId);
    const latest = await this.prisma.message.findFirst({
      where: { conversationId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (!latest) return;
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { lastReadMessageId: latest.id },
    });
  }

  private toDto(row: ConversationWithParticipants, currentUserId: string): ConversationDTO {
    const participants: ParticipantDTO[] = row.participants.map((p) => ({
      user: p.user,
      joinedAt: p.joinedAt.toISOString(),
      leftAt: p.leftAt?.toISOString() ?? null,
      lastReadMessageId: p.lastReadMessageId,
    }));

    const latestMessage = row.messages[0];
    const currentParticipant = row.participants.find((p) => p.userId === currentUserId);
    const hasUnreadMessages =
      !!latestMessage &&
      latestMessage.senderId !== currentUserId &&
      latestMessage.id !== currentParticipant?.lastReadMessageId;

    return {
      id: row.id,
      isGroup: row.isGroup,
      name: row.name,
      createdById: row.createdById,
      displayName: computeDisplayName(row, participants, currentUserId),
      participants,
      lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      hasUnreadMessages,
      isStarred: currentParticipant?.isStarred ?? false,
      isBlocked: currentParticipant?.blockedAt != null,
      requestState: row.requestPending
        ? row.createdById === currentUserId
          ? 'outgoing'
          : 'incoming'
        : 'none',
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

// Sandbox isolation: a guest may only converse with demo characters, and a real
// member only with other members. Defends the create/add paths against
// hand-crafted requests that bypass the filtered user search.
function assertRecipientsAllowed(
  actorKind: UserKind,
  recipients: { email: string; kind: UserKind }[],
) {
  const requiredKind: UserKind = actorKind === 'guest' ? 'demo' : 'member';
  const disallowed = recipients.filter((r) => r.kind !== requiredKind);
  if (disallowed.length) {
    throw new ForbiddenException({
      error: {
        code: CONVERSATION_ERROR_CODES.recipientsNotAllowed,
        message:
          actorKind === 'guest'
            ? 'Demo accounts can only message the sample users.'
            : 'These recipients are not available.',
        details: { recipients: disallowed.map((r) => r.email) },
      },
    });
  }
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

function participantsBlockedError(blocked: string[]) {
  return {
    error: {
      code: CONVERSATION_ERROR_CODES.participantsBlocked,
      message: `Blocked this group and can't be re-added: ${blocked.join(', ')}`,
      details: { blockedEmails: blocked },
    },
  };
}
