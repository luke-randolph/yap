import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type AuthTokenResponse,
  type RequestAccessInput,
  type RequestOtpInput,
  type VerifyOtpInput,
  requestAccessSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '@yap/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CurrentUser } from './current-user.decorator';
import { AuthService, type TokenIssuance } from './auth.service';
import { JwtAuthGuard, type AccessTokenPayload } from './jwt-auth.guard';

const REFRESH_COOKIE_NAME = 'yap_refresh';
const REFRESH_COOKIE_PATH = '/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Body(new ZodValidationPipe(requestOtpSchema)) body: RequestOtpInput,
    @Ip() ip: string,
  ): Promise<{ ok: true }> {
    await this.auth.requestOtp(body.email, ip);
    return { ok: true };
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpInput,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const issuance = await this.auth.verifyOtp(body.email, body.code, body.displayName, {
      userAgent,
      ipAddress: ip,
    });
    setRefreshCookie(res, issuance);
    return toAuthResponse(issuance);
  }

  @Post('demo')
  @HttpCode(HttpStatus.OK)
  async demo(
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const issuance = await this.auth.createDemoSession({ userAgent, ipAddress: ip });
    setRefreshCookie(res, issuance);
    return toAuthResponse(issuance);
  }

  @Post('access-request')
  @HttpCode(HttpStatus.OK)
  async requestAccess(
    @Body(new ZodValidationPipe(requestAccessSchema)) body: RequestAccessInput,
  ): Promise<{ ok: true }> {
    await this.auth.requestAccess(body.email, body.displayName);
    return { ok: true };
  }

  @Post('demo/exit')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async exitDemo(
    @CurrentUser() current: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.exitDemo(current.sub);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const cookie = readRefreshCookie(req);
    const issuance = await this.auth.refresh(cookie, { userAgent, ipAddress: ip });
    setRefreshCookie(res, issuance);
    return toAuthResponse(issuance);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const cookie = readRefreshCookie(req);
    await this.auth.logout(cookie);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }
}

function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_COOKIE_NAME];
}

function toAuthResponse(issuance: TokenIssuance): AuthTokenResponse {
  return {
    accessToken: issuance.accessToken,
    expiresIn: issuance.expiresIn,
    user: issuance.user,
  };
}

function setRefreshCookie(res: Response, issuance: TokenIssuance): void {
  res.cookie(REFRESH_COOKIE_NAME, issuance.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    expires: issuance.refreshExpiresAt,
  });
}
