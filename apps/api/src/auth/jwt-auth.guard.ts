import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

declare module 'express' {
  interface Request {
    user?: AccessTokenPayload;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException(authError('Missing bearer token'));
    }
    const token = header.slice(7);
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException(authError('Invalid or expired token'));
    }
  }
}

function authError(message: string) {
  return { error: { code: 'UNAUTHENTICATED', message } };
}
