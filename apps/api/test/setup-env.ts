import { testDatabaseUrl } from './test-database-url';

// Runs in each worker before the framework loads, so PrismaService and
// ConfigService pick up these values. `??=` lets CI override any of them.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
process.env.JWT_ACCESS_TTL_SECONDS ??= '900';
process.env.JWT_REFRESH_TTL_DAYS ??= '30';
process.env.EMAIL_TRANSPORT ??= 'console';
process.env.MAIL_FROM ??= 'Yap <test@example.com>';
process.env.ADMIN_EMAIL ??= 'admin@example.com';
process.env.WEB_ORIGIN ??= 'http://localhost:3000';
process.env.PUBLIC_API_URL ??= 'http://localhost:3333';
process.env.STORAGE_DRIVER ??= 'local';
