import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

// Runs after JwtAuthGuard, so req.user carries the isAdmin claim.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user?.isAdmin) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN_ADMIN', message: 'Admin access required' },
      });
    }
    return true;
  }
}
