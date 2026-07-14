import { AUTH_ERROR_CODES } from '@yap/contracts';
import { createTestContext, expectErrorCode, type TestContext } from '../../test/helpers/app';
import { resetDb } from '../../test/helpers/db';
import { createUser, seedOtp, seedRefreshToken, uniqueEmail } from '../../test/helpers/factories';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let ctx: TestContext;
  let auth: AuthService;
  let prisma: PrismaService;

  beforeAll(async () => {
    ctx = await createTestContext();
    auth = ctx.app.get(AuthService);
    prisma = ctx.prisma;
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  describe('requestOtp', () => {
    it('rejects an email that is not allowlisted', async () => {
      await expectErrorCode(
        auth.requestOtp(uniqueEmail('stranger')),
        AUTH_ERROR_CODES.emailNotAllowlisted,
      );
    });

    it('issues an OTP for an existing user', async () => {
      const user = await createUser(prisma);
      await auth.requestOtp(user.email);
      expect(await prisma.emailOtp.count({ where: { email: user.email } })).toBe(1);
    });

    it('issues an OTP for an approved access request', async () => {
      const email = uniqueEmail('approved');
      await prisma.accessRequest.create({ data: { email, status: 'approved' } });
      await auth.requestOtp(email);
      expect(await prisma.emailOtp.count({ where: { email } })).toBe(1);
    });

    it('silently succeeds once the request rate limit is hit', async () => {
      const user = await createUser(prisma);
      for (let i = 0; i < 5; i++) await seedOtp(prisma, user.email, '000000');
      await expect(auth.requestOtp(user.email)).resolves.toBeUndefined();
      // No sixth code is created — enumeration is not observable.
      expect(await prisma.emailOtp.count({ where: { email: user.email } })).toBe(5);
    });
  });

  describe('verifyOtp', () => {
    it('rejects when there is no code', async () => {
      const user = await createUser(prisma);
      await expectErrorCode(
        auth.verifyOtp(user.email, '123456', undefined, {}),
        AUTH_ERROR_CODES.otpInvalid,
      );
    });

    it('rejects an expired code', async () => {
      const user = await createUser(prisma);
      await seedOtp(prisma, user.email, '123456', { expiresAt: new Date(Date.now() - 1000) });
      await expectErrorCode(
        auth.verifyOtp(user.email, '123456', undefined, {}),
        AUTH_ERROR_CODES.otpInvalid,
      );
    });

    it('increments attempts and rejects a wrong code', async () => {
      const user = await createUser(prisma);
      const otp = await seedOtp(prisma, user.email, '123456');
      await expectErrorCode(
        auth.verifyOtp(user.email, '999999', undefined, {}),
        AUTH_ERROR_CODES.otpInvalid,
      );
      const after = await prisma.emailOtp.findUniqueOrThrow({ where: { id: otp.id } });
      expect(after.attempts).toBe(1);
      expect(after.consumedAt).toBeNull();
    });

    it('locks out and consumes the code after too many attempts', async () => {
      const user = await createUser(prisma);
      const otp = await seedOtp(prisma, user.email, '123456', { attempts: 5 });
      await expectErrorCode(
        auth.verifyOtp(user.email, '123456', undefined, {}),
        AUTH_ERROR_CODES.otpTooManyAttempts,
      );
      const after = await prisma.emailOtp.findUniqueOrThrow({ where: { id: otp.id } });
      expect(after.consumedAt).not.toBeNull();
    });

    it('signs in an existing user and consumes the code', async () => {
      const user = await createUser(prisma);
      const otp = await seedOtp(prisma, user.email, '123456');
      const result = await auth.verifyOtp(user.email, '123456', undefined, {});
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toContain('.');
      expect(result.user.id).toBe(user.id);
      const after = await prisma.emailOtp.findUniqueOrThrow({ where: { id: otp.id } });
      expect(after.consumedAt).not.toBeNull();
    });

    it('requires a display name for a first-time signup without consuming the code', async () => {
      const email = uniqueEmail('newbie');
      await prisma.accessRequest.create({ data: { email, status: 'approved' } });
      const otp = await seedOtp(prisma, email, '123456');
      await expectErrorCode(
        auth.verifyOtp(email, '123456', undefined, {}),
        AUTH_ERROR_CODES.displayNameRequired,
      );
      const after = await prisma.emailOtp.findUniqueOrThrow({ where: { id: otp.id } });
      expect(after.consumedAt).toBeNull();
    });

    it('creates the account when a first-time signup supplies a display name', async () => {
      const email = uniqueEmail('newbie');
      await prisma.accessRequest.create({ data: { email, status: 'approved' } });
      await seedOtp(prisma, email, '123456');
      const result = await auth.verifyOtp(email, '123456', 'Fresh Face', {});
      expect(result.user.displayName).toBe('Fresh Face');
      const created = await prisma.user.findUnique({ where: { email } });
      expect(created).not.toBeNull();
    });

    it('refuses to create an account for a non-allowlisted email', async () => {
      const email = uniqueEmail('ghost');
      await seedOtp(prisma, email, '123456');
      await expectErrorCode(
        auth.verifyOtp(email, '123456', 'Ghost', {}),
        AUTH_ERROR_CODES.emailNotAllowlisted,
      );
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    });
  });

  describe('refresh', () => {
    it('rotates the token and revokes the presented one', async () => {
      const user = await createUser(prisma);
      const token = await seedRefreshToken(prisma, user.id);
      const oldId = token.split('.')[0];

      const rotated = await auth.refresh(token, {});
      expect(rotated.refreshToken).not.toBe(token);

      const oldRow = await prisma.refreshToken.findUniqueOrThrow({ where: { id: oldId } });
      expect(oldRow.revokedAt).not.toBeNull();
    });

    it('detects reuse of a revoked token and revokes the whole family (theft)', async () => {
      const user = await createUser(prisma);
      const token = await seedRefreshToken(prisma, user.id);

      const rotated = await auth.refresh(token, {});
      // Replaying the already-rotated token trips theft detection.
      await expectErrorCode(auth.refresh(token, {}), 'REFRESH_INVALID');
      // ...which also kills the legitimately-issued replacement.
      await expectErrorCode(auth.refresh(rotated.refreshToken, {}), 'REFRESH_INVALID');
      expect(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } })).toBe(
        0,
      );
    });

    it('rejects a malformed token', async () => {
      await expectErrorCode(auth.refresh('not-a-token', {}), 'REFRESH_INVALID');
    });

    it('rejects an expired token', async () => {
      const user = await createUser(prisma);
      const token = await seedRefreshToken(prisma, user.id, {
        expiresAt: new Date(Date.now() - 1000),
      });
      await expectErrorCode(auth.refresh(token, {}), 'REFRESH_INVALID');
    });
  });

  describe('logout', () => {
    it('revokes the token so a later refresh fails', async () => {
      const user = await createUser(prisma);
      const token = await seedRefreshToken(prisma, user.id);
      await auth.logout(token);
      await expectErrorCode(auth.refresh(token, {}), 'REFRESH_INVALID');
    });
  });
});
