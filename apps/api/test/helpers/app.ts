import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../../src/auth/auth.module';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { FriendsModule } from '../../src/friends/friends.module';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RealtimeModule } from '../../src/realtime/realtime.module';
import { UsersModule } from '../../src/users/users.module';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export interface RealtimeContext extends TestContext {
  url: string;
}

// Boots the real feature modules against the test database. No HTTP listener,
// no throttler, no realtime gateway — just the service graph under test.
export async function createTestContext(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      EventEmitterModule.forRoot(),
      PrismaModule,
      AuthModule,
      FriendsModule,
      ConversationsModule,
      UsersModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function createRealtimeContext(): Promise<RealtimeContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      EventEmitterModule.forRoot(),
      PrismaModule,
      AuthModule,
      FriendsModule,
      ConversationsModule,
      UsersModule,
      RealtimeModule,
    ],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0);
  const address = (app.getHttpServer() as Server).address() as AddressInfo;
  return { app, prisma: app.get(PrismaService), url: `http://127.0.0.1:${address.port}` };
}

export async function signAccessToken(
  app: INestApplication,
  user: { id: string; email: string; isAdmin?: boolean; isGuest?: boolean },
): Promise<string> {
  const jwt = app.get(JwtService);
  const config = app.get(ConfigService);
  return jwt.signAsync(
    {
      sub: user.id,
      email: user.email,
      isAdmin: user.isAdmin ?? false,
      isGuest: user.isGuest ?? false,
    },
    { secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: 900 },
  );
}

export async function expectErrorCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (err) {
    const body: unknown = err instanceof HttpException ? err.getResponse() : err;
    expect(body).toMatchObject({ error: { code } });
    return;
  }
  throw new Error(`Expected rejection with error code "${code}", but it resolved`);
}
