import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ConfigService } from '@nestjs/config';
import type { StorageAdapter } from './storage.interface';

export class R2StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.bucket = required(config, 'R2_BUCKET');
    this.publicUrl = required(config, 'R2_PUBLIC_URL').replace(/\/$/, '');
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${required(config, 'R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: required(config, 'R2_ACCESS_KEY_ID'),
        secretAccessKey: required(config, 'R2_SECRET_ACCESS_KEY'),
      },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `${this.publicUrl}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}

function required(config: ConfigService, name: string): string {
  const value = config.get<string>(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}
