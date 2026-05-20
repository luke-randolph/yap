import { Prisma } from '@prisma/client';

export const userPublicSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;
