import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { testDatabaseUrl } from './test-database-url';

// Creates the test database if it doesn't exist and applies all migrations,
// once, before the suite runs.
export default async function globalSetup(): Promise<void> {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.replace(/^\//, '');

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/already exists/i.test(message)) throw err;
  } finally {
    await admin.$disconnect();
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
