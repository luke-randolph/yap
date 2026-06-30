import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  type AccessRequestDTO,
  type AccessRequestListQueryInput,
  type CreateAllowedEmailInput,
  accessRequestListQuerySchema,
  createAllowedEmailSchema,
} from '@yap/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('access-requests')
  list(
    @Query(new ZodValidationPipe(accessRequestListQuerySchema)) query: AccessRequestListQueryInput,
  ): Promise<AccessRequestDTO[]> {
    return this.admin.listAccessRequests(query.status);
  }

  @Post('access-requests')
  add(
    @Body(new ZodValidationPipe(createAllowedEmailSchema)) body: CreateAllowedEmailInput,
  ): Promise<AccessRequestDTO> {
    return this.admin.addAllowedEmail(body.email, body.note);
  }

  @Post('access-requests/:id/approve')
  approve(@Param('id') id: string): Promise<AccessRequestDTO> {
    return this.admin.approve(id);
  }

  @Post('access-requests/:id/deny')
  deny(@Param('id') id: string): Promise<AccessRequestDTO> {
    return this.admin.deny(id);
  }

  @Delete('access-requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.admin.remove(id);
  }
}
