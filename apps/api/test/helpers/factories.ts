import { randomBytes } from 'node:crypto';
import type { UserKind } from '@prisma/client';
import * as argon2 from 'argon2';
import type { PrismaService } from '../../src/prisma/prisma.service';

let seq = 0;
export function uniqueEmail(prefix = 'user'): string {
  seq += 1;
  return `${prefix}-${seq}@example.com`;
}

export async function createUser(
  prisma: PrismaService,
  data: { email?: string; displayName?: string; kind?: UserKind; isAdmin?: boolean } = {},
) {
  return prisma.user.create({
    data: {
      email: data.email ?? uniqueEmail(),
      displayName: data.displayName ?? 'Test User',
      kind: data.kind ?? 'member',
      isAdmin: data.isAdmin ?? false,
    },
  });
}

// Inserts an OTP row directly with a known plaintext code, so verifyOtp can be
// exercised (requestOtp only ever stores the argon2 hash).
export async function seedOtp(
  prisma: PrismaService,
  email: string,
  code = '123456',
  overrides: { expiresAt?: Date; attempts?: number; consumedAt?: Date | null } = {},
) {
  return prisma.emailOtp.create({
    data: {
      email,
      codeHash: await argon2.hash(code),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 10 * 60_000),
      attempts: overrides.attempts ?? 0,
      consumedAt: overrides.consumedAt ?? null,
    },
  });
}

// Creates a refresh-token row and returns the raw `id.secret` string the client
// would hold, so refresh/rotation/reuse paths can be driven directly.
export async function seedRefreshToken(
  prisma: PrismaService,
  userId: string,
  overrides: { expiresAt?: Date; revokedAt?: Date | null } = {},
): Promise<string> {
  const secret = randomBytes(16).toString('hex');
  const row = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: await argon2.hash(secret),
      expiresAt: overrides.expiresAt ?? new Date(Date.now() + 24 * 60 * 60_000),
      revokedAt: overrides.revokedAt ?? null,
    },
  });
  return `${row.id}.${secret}`;
}
