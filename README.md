# Yap

[![CI](https://github.com/luke-randolph/yap/actions/workflows/ci.yml/badge.svg)](https://github.com/luke-randolph/yap/actions/workflows/ci.yml)

Real-time chat — direct messages and group chats with live delivery, passwordless email-OTP auth, friends, blocking, reactions, image sharing, and an anonymous demo mode.

**▶ Live demo: [yap.luke-randolph.com](https://yap.luke-randolph.com)** — click **Try the demo** to drop straight into a seeded chat as a guest; no signup required.

![Yap](docs/demo.png)

## Features

- **Real-time messaging** — 1:1 DMs and group chats, delivered live over socket.io with optimistic send and de-duplication
- **Rich messages** — replies, edits, unsend, emoji reactions, pinning, and image attachments (re-encoded to webp)
- **Read state** — per-conversation unread indicators and read receipts
- **Social graph** — friend requests, message-request gating so non-friends can't spam you, plus user-level and conversation-level blocking
- **Passwordless auth** — email one-time-code login; invite-only access with an admin approval queue
- **Demo mode** — anonymous guests get a private, seeded sandbox with sample characters — no account needed
- **Polish** — light/dark themes, responsive layout, in-app toasts

## Tech stack

- **Backend** — NestJS 11 + TypeScript
- **Database** — PostgreSQL + Prisma
- **Frontend** — Nuxt 4 + Vue 3 + Tailwind v4 + shadcn-vue
- **Realtime** — socket.io via a NestJS WebSocket gateway
- **Auth** — passwordless email OTP (Resend); JWT access + rotating refresh tokens (argon2), with refresh-token reuse/theft detection
- **Storage** — pluggable local disk / Cloudflare R2 adapter; images processed with sharp
- **Tooling** — pnpm workspaces + Turborepo, ESLint (type-aware) + Prettier, Jest, GitHub Actions CI
- **Hosting** — Render (API + web + Postgres), Cloudflare R2 (uploads)

## Architecture

A pnpm + Turborepo monorepo with a shared contracts package as the single source of truth across client and server.

```
apps/
  api/                  NestJS API (REST + socket.io gateway)
    prisma/             schema.prisma, migrations, seed
  web/                  Nuxt 4 frontend
packages/
  contracts/            shared zod schemas, DTOs, socket event types (@yap/contracts)
render.yaml             Render blueprint (API + web + Postgres)
docker-compose.yml      local Postgres
.github/workflows/      CI
```

- **Shared contracts** — request/response DTOs, validation schemas, and socket event types live in `@yap/contracts`, so the API and web app can't drift out of sync.
- **Realtime** — the gateway authenticates each socket, joins it to a per-user room, and fans server-side events out to exactly the participants of a conversation.
- **Auth** — short-lived JWT access tokens plus opaque, argon2-hashed refresh tokens that rotate on use; replaying a revoked token revokes the whole token family.

## Local development

Prereqs: Node 24, pnpm 10, Docker.

```sh
pnpm install
docker compose up -d        # starts Postgres
pnpm --filter @yap/api exec prisma migrate dev
pnpm dev                    # web on :3000, api on :3333
```

In development, `EMAIL_TRANSPORT=console` prints OTP login codes to the API console, so you can sign in without configuring email. Copy `apps/api/.env.example` and `apps/web/.env.example` to `.env` to get started.

## Testing

```sh
pnpm --filter @yap/api test   # requires Docker Postgres running
```

Integration and gateway tests run against a throwaway Postgres database (auto-created and migrated), covering auth (OTP, token rotation, theft detection), conversation access-control, friendships, blocking, and realtime message delivery.

## Deployment

Deployed on **Render** (API + web + managed Postgres) with **Cloudflare R2** for uploads. The whole stack is defined as a Render Blueprint in [`render.yaml`](./render.yaml); the API is containerized via [`apps/api/Dockerfile`](./apps/api/Dockerfile) and runs migrations on start.
