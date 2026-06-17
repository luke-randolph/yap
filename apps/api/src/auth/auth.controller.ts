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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  type AuthTokenResponse,
  type RequestOtpInput,
  type VerifyOtpInput,
  requestOtpSchema,
  verifyOtpSchema,
} from '@yap/contracts';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AuthService, type TokenIssuance } from './auth.service';

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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Headers('user-agent') userAgent: string | undefined,
    @Ip() ip: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthTokenResponse> {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const issuance = await this.auth.refresh(cookie, { userAgent, ipAddress: ip });
    setRefreshCookie(res, issuance);
    return toAuthResponse(issuance);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const cookie = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.auth.logout(cookie);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
  }
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
