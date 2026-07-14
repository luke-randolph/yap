FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /repo
COPY . .

RUN pnpm install --frozen-lockfile --filter "@yap/api..."
RUN pnpm --filter @yap/contracts build && pnpm --filter @yap/api build

WORKDIR /repo/apps/api
EXPOSE 3333
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main"]
