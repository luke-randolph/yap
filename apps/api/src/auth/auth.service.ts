import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomInt } from 'node:crypto';
import { AUTH_ERROR_CODES, type AuthTokenResponse } from '@yap/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { type AccessTokenPayload } from './jwt-auth.guard';

const OTP_TTL_MIN = 10;
const OTP_REQUEST_WINDOW_MIN = 10;
const OTP_REQUEST_LIMIT = 5;
const OTP_MAX_ATTEMPTS = 5;

export interface TokenIssuance extends AuthTokenResponse {
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Shared by the HTTP guard and the websocket gateway so the secret name and
  // payload type live in one place. Throws on an invalid or expired token.
  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async requestOtp(emailAddress: string, ipAddress?: string): Promise<void> {
    const windowStart = new Date(Date.now() - OTP_REQUEST_WINDOW_MIN * 60_000);
    const recentCount = await this.prisma.emailOtp.count({
      where: { email: emailAddress, createdAt: { gte: windowStart } },
    });
    // Silently succeed when rate-limited so attackers can't probe email targeting.
    if (recentCount >= OTP_REQUEST_LIMIT) return;

    const code = randomInt(100_000, 1_000_000).toString().padStart(6, '0');
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await this.prisma.emailOtp.create({
      data: { email: emailAddress, codeHash, expiresAt, ipAddress },
    });

    await this.email.sendOtp({ to: emailAddress, code });
  }

  async verifyOtp(
    emailAddress: string,
    code: string,
    displayName: string | undefined,
    sessionMeta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenIssuance> {
    const otp = await this.prisma.emailOtp.findFirst({
      where: { email: emailAddress, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException({
        error: { code: AUTH_ERROR_CODES.otpInvalid, message: 'Invalid or expired code' },
      });
    }

    if (otp.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestException({
        error: {
          code: AUTH_ERROR_CODES.otpTooManyAttempts,
          message: 'Too many attempts; request a new code',
        },
      });
    }

    const valid = await argon2.verify(otp.codeHash, code);
    if (!valid) {
      await this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException({
        error: { code: AUTH_ERROR_CODES.otpInvalid, message: 'Invalid or expired code' },
      });
    }

    const existing = await this.prisma.user.findUnique({ where: { email: emailAddress } });

    // First-time signup needs a display name. Don't consume the OTP yet —
    // the client can resubmit the same code with displayName populated.
    if (!existing && !displayName) {
      throw new BadRequestException({
        error: {
          code: AUTH_ERROR_CODES.displayNameRequired,
          message: 'Display name required to finish signing up',
        },
      });
    }

    const [, user] = await this.prisma.$transaction([
      this.prisma.emailOtp.update({
        where: { id: otp.id },
        data: { consumedAt: new Date() },
      }),
      existing
        ? this.prisma.user.update({ where: { id: existing.id }, data: {} })
        : this.prisma.user.create({
            data: { email: emailAddress, displayName: displayName! },
          }),
    ]);

    return this.issueTokens(user.id, sessionMeta);
  }

  async refresh(
    rawToken: string | undefined,
    sessionMeta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenIssuance> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) throw new UnauthorizedException(refreshInvalidError());

    const row = await this.prisma.refreshToken.findUnique({ where: { id: parsed.tokenId } });
    if (!row) throw new UnauthorizedException(refreshInvalidError());

    if (row.revokedAt) {
      // Reuse detected: a revoked token was presented again. Treat as theft;
      // revoke every active refresh token for this user.
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(refreshInvalidError());
    }

    if (row.expiresAt < new Date()) throw new UnauthorizedException(refreshInvalidError());

    const valid = await argon2.verify(row.tokenHash, parsed.secret);
    if (!valid) throw new UnauthorizedException(refreshInvalidError());

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(row.userId, sessionMeta);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(rawToken);
    if (!parsed) return;
    await this.prisma.refreshToken.updateMany({
      where: { id: parsed.tokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(
    userId: string,
    sessionMeta: { userAgent?: string; ipAddress?: string },
  ): Promise<TokenIssuance> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const accessTtl = Number(this.config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? 900);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email },
      { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: accessTtl },
    );

    const refreshTtlDays = Number(this.config.get<string>('JWT_REFRESH_TTL_DAYS') ?? 30);
    const refreshExpiresAt = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
    const secret = randomBytes(32).toString('hex');
    const secretHash = await argon2.hash(secret);

    const row = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: secretHash,
        expiresAt: refreshExpiresAt,
        userAgent: sessionMeta.userAgent,
        ipAddress: sessionMeta.ipAddress,
      },
    });

    return {
      accessToken,
      expiresIn: accessTtl,
      refreshToken: `${row.id}.${secret}`,
      refreshExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}

function parseRefreshToken(raw: string | undefined): { tokenId: string; secret: string } | null {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot <= 0) return null;
  const tokenId = raw.slice(0, dot);
  const secret = raw.slice(dot + 1);
  if (!tokenId || !secret) return null;
  return { tokenId, secret };
}

function refreshInvalidError() {
  return { error: { code: 'REFRESH_INVALID', message: 'Refresh token invalid or expired' } };
}
