import { PrismaClient } from '@prisma/client';
import { sign } from 'jsonwebtoken';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const fixtures = [
    { email: 'alice@yap.dev', displayName: 'Alice' },
    { email: 'bob@yap.dev', displayName: 'Bob' },
    { email: 'carol@yap.dev', displayName: 'Carol' },
  ];

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET missing');

  const out: Record<string, { id: string; token: string }> = {};
  for (const f of fixtures) {
    const user = await prisma.user.upsert({
      where: { email: f.email },
      update: {},
      create: f,
    });
    const token = sign({ sub: user.id, email: user.email }, secret, { expiresIn: '1h' });
    out[f.displayName] = { id: user.id, token };
  }

  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
