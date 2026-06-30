import { PrismaClient } from '@prisma/client';
import { DEMO_CHARACTERS } from '../src/demo/demo.data';

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env var is required to seed`);
  return value;
}

const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');

async function main() {
  // The sole admin / real account.
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { isAdmin: true, kind: 'member' },
    create: { email: ADMIN_EMAIL, displayName: 'Luke', isAdmin: true, kind: 'member' },
  });
  // Allowlist the admin so the signup guard always lets them in.
  await prisma.accessRequest.upsert({
    where: { email: ADMIN_EMAIL },
    update: { status: 'approved' },
    create: { email: ADMIN_EMAIL, displayName: 'Luke', status: 'approved' },
  });

  // Fake characters every demo guest can chat with.
  for (const c of DEMO_CHARACTERS) {
    await prisma.user.upsert({
      where: { email: c.email },
      update: { displayName: c.displayName, kind: 'demo' },
      create: { email: c.email, displayName: c.displayName, kind: 'demo' },
    });
  }

  console.log(`Seeded admin + ${DEMO_CHARACTERS.length} demo character(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
