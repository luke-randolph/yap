import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import type { StorageAdapter } from './storage.interface';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
const PUBLIC_PREFIX = '/uploads/';

export class LocalStorageAdapter implements StorageAdapter {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3333').replace(
      /\/$/,
      '',
    );
  }

  async put(key: string, body: Buffer): Promise<string> {
    const dest = join(UPLOADS_DIR, key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, body);
    return `${this.baseUrl}${PUBLIC_PREFIX}${key}`;
  }

  async delete(key: string): Promise<void> {
    await rm(join(UPLOADS_DIR, key), { force: true });
  }

  keyFromUrl(url: string): string | null {
    const i = url.indexOf(PUBLIC_PREFIX);
    return i === -1 ? null : url.slice(i + PUBLIC_PREFIX.length);
  }
}
