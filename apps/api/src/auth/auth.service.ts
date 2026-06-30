import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomInt } from 'node:crypto';
import { AUTH_ERROR_CODES, type AuthTokenResponse } from '@yap/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { DemoService } from '../demo/demo.service';
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
    private readonly demo: DemoService,
  ) {}

  // A signup is allowed only for emails that already have an account
  // (existing members, including the admin) or an approved access request.
  private async isSignupAllowed(emailAddress: string): Promise<boolean> {
    const existing = await this.prisma.user.findUnique({
      where: { email: emailAddress },
      select: { id: true },
    });
    if (existing) return true;
    const request = await this.prisma.accessRequest.findUnique({
      where: { email: emailAddress },
      select: { status: true },
    });
    return request?.status === 'approved';
  }

  // Records (or refreshes) a pending access request for a non-allowlisted email
  // and pings the admin. Idempotent and respects prior approve/deny decisions.
  async requestAccess(emailAddress: string, displayName?: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({
      where: { email: emailAddress },
      select: { id: true },
    });
    if (existing) return;

    const current = await this.prisma.accessRequest.findUnique({ where: { email: emailAddress } });
    if (current) {
      // Respect an existing approve/deny; only refresh a still-pending name.
      if (current.status === 'pending' && displayName && displayName !== current.displayName) {
        await this.prisma.accessRequest.update({
          where: { email: emailAddress },
          data: { displayName },
        });
      }
      return;
    }

    await this.prisma.accessRequest.create({
      data: { email: emailAddress, displayName, status: 'pending' },
    });
    void this.email
      .sendAccessRequested({ requesterEmail: emailAddress, displayName })
      .catch(() => undefined);
  }

  // Spins up a throwaway sandboxed guest and logs it in immediately.
  async createDemoSession(sessionMeta: {
    userAgent?: string;
    ipAddress?: string;
  }): Promise<TokenIssuance> {
    const guestId = await this.demo.createGuestWithWorld();
    return this.issueTokens(guestId, sessionMeta);
  }

  async exitDemo(userId: string): Promise<void> {
    await this.demo.deleteGuestAndSandbox(userId);
  }

  // Shared by the HTTP guard and the websocket gateway so the secret name and
  // payload type live in one place. Throws on an invalid or expired token.
  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async requestOtp(emailAddress: string, ipAddress?: string): Promise<void> {
    if (!(await this.isSignupAllowed(emailAddress))) {
      throw new BadRequestException({
        error: {
          code: AUTH_ERROR_CODES.emailNotAllowlisted,
          message: 'Yap is approval-only right now. Request access to join.',
        },
      });
    }

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

    // Defense in depth: never create an account for a non-allowlisted email,
    // even if an OTP somehow exists.
    if (!existing && !(await this.isSignupAllowed(emailAddress))) {
      throw new BadRequestException({
        error: {
          code: AUTH_ERROR_CODES.emailNotAllowlisted,
          message: 'Yap is approval-only right now. Request access to join.',
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

    const isGuest = user.kind === 'guest';
    const accessTtl = Number(this.config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? 900);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, isAdmin: user.isAdmin, isGuest },
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
        isAdmin: user.isAdmin,
        isGuest,
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
