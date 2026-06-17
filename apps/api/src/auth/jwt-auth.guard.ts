import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

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
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException(authError('Missing bearer token'));
    }
    const token = header.slice(7);
    try {
      req.user = await this.auth.verifyAccessToken(token);
      return true;
    } catch {
      throw new UnauthorizedException(authError('Invalid or expired token'));
    }
  }
}

function authError(message: string) {
  return { error: { code: 'UNAUTHENTICATED', message } };
}
