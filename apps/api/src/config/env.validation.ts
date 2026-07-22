import { z } from 'zod';

const baseSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  EMAIL_TRANSPORT: z.enum(['console', 'resend']).default('console'),
  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().min(1),
  ADMIN_EMAIL: z.string().email(),

  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:3333'),

  STORAGE_DRIVER: z.enum(['local', 'r2']).default('local'),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  SENTRY_DSN: z.string().url().optional(),

  GIPHY_API_KEY: z.string().optional(),
  GIF_PROXY_SECRET: z.string().optional(),
});

const envSchema = baseSchema
  .refine((env) => env.EMAIL_TRANSPORT !== 'resend' || !!env.RESEND_API_KEY, {
    message: 'RESEND_API_KEY is required when EMAIL_TRANSPORT=resend',
    path: ['RESEND_API_KEY'],
  })
  .refine(
    (env) =>
      env.STORAGE_DRIVER !== 'r2' ||
      (!!env.R2_ACCOUNT_ID &&
        !!env.R2_ACCESS_KEY_ID &&
        !!env.R2_SECRET_ACCESS_KEY &&
        !!env.R2_BUCKET &&
        !!env.R2_PUBLIC_URL),
    { message: 'All R2_* vars are required when STORAGE_DRIVER=r2', path: ['STORAGE_DRIVER'] },
  );

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
