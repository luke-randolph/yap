import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessRequest, AccessStatus } from '@prisma/client';
import type { AccessRequestDTO } from '@yap/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async listAccessRequests(status: AccessStatus | 'all'): Promise<AccessRequestDTO[]> {
    const rows = await this.prisma.accessRequest.findMany({
      where: status === 'all' ? {} : { status },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  // Proactively allowlist an email (creates it already approved).
  async addAllowedEmail(email: string, note?: string): Promise<AccessRequestDTO> {
    const row = await this.prisma.accessRequest.upsert({
      where: { email },
      update: { status: 'approved', note: note ?? undefined },
      create: { email, status: 'approved', note },
    });
    return toDto(row);
  }

  async approve(id: string): Promise<AccessRequestDTO> {
    const row = await this.setStatus(id, 'approved');
    void this.email
      .sendAccessApproved({ to: row.email, displayName: row.displayName })
      .catch(() => undefined);
    return toDto(row);
  }

  async deny(id: string): Promise<AccessRequestDTO> {
    return toDto(await this.setStatus(id, 'denied'));
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await this.prisma.accessRequest.delete({ where: { id } });
  }

  private async setStatus(id: string, status: AccessStatus): Promise<AccessRequest> {
    await this.getOrThrow(id);
    return this.prisma.accessRequest.update({ where: { id }, data: { status } });
  }

  private async getOrThrow(id: string): Promise<AccessRequest> {
    const row = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException({
        error: { code: 'ACCESS_REQUEST_NOT_FOUND', message: 'Access request not found' },
      });
    }
    return row;
  }
}

function toDto(row: AccessRequest): AccessRequestDTO {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: row.status,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}
