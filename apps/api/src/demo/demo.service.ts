import { randomBytes, randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DEMO_CHARACTERS, DEMO_DM, DEMO_GROUP, GUEST_NAMES } from './demo.data';

const MESSAGE_SPACING_MS = 60_000;

@Injectable()
export class DemoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upserts the fake demo characters, returning an email → userId map. */
  async ensureDemoCharacters(): Promise<Record<string, string>> {
    const map: Record<string, string> = {};
    for (const c of DEMO_CHARACTERS) {
      const user = await this.prisma.user.upsert({
        where: { email: c.email },
        update: { displayName: c.displayName, kind: 'demo' },
        create: { email: c.email, displayName: c.displayName, kind: 'demo' },
      });
      map[c.email] = user.id;
    }
    return map;
  }

  /** Creates a fresh sandboxed guest with its own private seeded conversations. */
  async createGuestWithWorld(): Promise<string> {
    const demoIds = await this.ensureDemoCharacters();
    const suffix = randomBytes(4).toString('hex');
    const displayName = GUEST_NAMES[randomInt(0, GUEST_NAMES.length)];
    const guest = await this.prisma.user.create({
      data: { email: `guest-${suffix}@demo.yap`, displayName, kind: 'guest' },
    });

    await this.seedGroup(guest.id, demoIds);
    await this.seedDm(guest.id, demoIds);
    return guest.id;
  }

  async deleteGuestAndSandbox(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { kind: true },
    });
    if (user?.kind !== 'guest') return;

    const parts = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const conversationIds = [...new Set(parts.map((p) => p.conversationId))];

    await this.prisma.$transaction([
      this.prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.emailOtp.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);
  }

  private async seedGroup(guestId: string, demoIds: Record<string, string>): Promise<void> {
    const creatorId = demoIds[DEMO_GROUP.creator];
    const memberIds = [guestId, ...DEMO_GROUP.members.map((email) => demoIds[email])];
    const base = Date.now() - DEMO_GROUP.messages.length * MESSAGE_SPACING_MS;

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: true,
        name: DEMO_GROUP.name,
        createdById: creatorId,
        participants: {
          create: memberIds.map((userId) => ({ userId, isAdmin: userId === creatorId })),
        },
      },
    });

    await this.seedMessages(
      conversation.id,
      DEMO_GROUP.messages.map((m) => ({ senderId: demoIds[m.from], body: m.body })),
      base,
    );
  }

  private async seedDm(guestId: string, demoIds: Record<string, string>): Promise<void> {
    const partnerId = demoIds[DEMO_DM.with];
    const base = Date.now() - DEMO_DM.messages.length * MESSAGE_SPACING_MS;

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: false,
        createdById: partnerId,
        participants: { create: [{ userId: guestId }, { userId: partnerId }] },
      },
    });

    await this.seedMessages(
      conversation.id,
      DEMO_DM.messages.map((m) => ({ senderId: demoIds[m.from], body: m.body })),
      base,
    );
  }

  // Inserts ordered messages with spaced timestamps so history reads naturally,
  // then bumps lastActivityAt for sidebar ordering.
  private async seedMessages(
    conversationId: string,
    messages: { senderId: string; body: string }[],
    base: number,
  ): Promise<void> {
    let lastAt = new Date(base);
    for (let i = 0; i < messages.length; i++) {
      lastAt = new Date(base + i * MESSAGE_SPACING_MS);
      await this.prisma.message.create({
        data: {
          conversationId,
          senderId: messages[i].senderId,
          body: messages[i].body,
          createdAt: lastAt,
        },
      });
    }
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: lastAt },
    });
  }
}
