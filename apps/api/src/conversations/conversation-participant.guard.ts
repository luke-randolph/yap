import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CONVERSATION_ERROR_CODES } from '@yap/contracts';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationParticipantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const userId = req.user?.sub;
    const rawId = req.params.conversationId;
    const conversationId = typeof rawId === 'string' ? rawId : undefined;
    if (!userId || !conversationId) throw new ForbiddenException(notParticipantError());

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { leftAt: true },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenException(notParticipantError());
    }
    return true;
  }
}

function notParticipantError() {
  return {
    error: {
      code: CONVERSATION_ERROR_CODES.notParticipant,
      message: 'Not a participant in this conversation',
    },
  };
}
