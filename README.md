# Yap

Real-time chat app — DMs and group chats with passwordless email OTP auth.

## Stack

- **Backend**: NestJS + TypeScript
- **DB**: Postgres + Prisma
- **Frontend**: Nuxt 3 + Vue 3 + Tailwind v4 + shadcn-vue
- **Realtime**: socket.io via NestJS gateway
- **Auth**: passwordless email OTP (Resend)
- **Repo**: pnpm workspaces + Turborepo

## Layout

```
apps/
  api/                  NestJS API
  web/                  Nuxt 3 frontend
packages/
  contracts/            shared zod schemas, DTOs, socket event types (@yap/contracts)
prisma/
  schema.prisma         data model
docker-compose.yml      local Postgres
```

## Local development

Prereqs: Node 20+, pnpm 9+, Docker.

```sh
pnpm install
docker compose up -d        # starts Postgres
pnpm prisma migrate dev     # apply schema (after Ticket 2)
pnpm dev                    # starts web (:3000) and api (:3333)
```

## Phase 1 status

Ship-list lives in `C:\Users\localAdmin\.claude\plans\can-you-help-me-snappy-raccoon.md`.
