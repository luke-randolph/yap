import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { type SendMessageAck } from '@yap/contracts';
import {
  createRealtimeContext,
  signAccessToken,
  type RealtimeContext,
} from '../../test/helpers/app';
import { resetDb } from '../../test/helpers/db';
import { createUser } from '../../test/helpers/factories';
import { ConversationsService } from '../conversations/conversations.service';

function connect(url: string, token?: string): Socket {
  return io(url, {
    transports: ['websocket'],
    reconnection: false,
    auth: token ? { token } : {},
  });
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (err) => reject(err));
  });
}

function waitForConnectError(socket: Socket): Promise<Error> {
  return new Promise((resolve, reject) => {
    socket.once('connect_error', (err) => resolve(err));
    socket.once('connect', () => reject(new Error('expected connection to be refused')));
  });
}

function sendMessage(
  socket: Socket,
  payload: { conversationId: string; body: string; clientMessageId: string },
): Promise<SendMessageAck> {
  return new Promise((resolve) => socket.emit('message.send', payload, resolve));
}

function waitForEvent<T>(socket: Socket, event: string, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('ChatGateway (e2e)', () => {
  let ctx: RealtimeContext;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    ctx = await createRealtimeContext();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDb(ctx.prisma);
  });

  afterEach(() => {
    for (const socket of openSockets.splice(0)) socket.disconnect();
  });

  function track(socket: Socket): Socket {
    openSockets.push(socket);
    return socket;
  }

  it('refuses a connection with no token', async () => {
    const socket = track(connect(ctx.url));
    const err = await waitForConnectError(socket);
    expect(err.message).toMatch(/token/i);
  });

  it('refuses a connection with an invalid token', async () => {
    const socket = track(connect(ctx.url, 'garbage.token.value'));
    const err = await waitForConnectError(socket);
    expect(err.message).toMatch(/token/i);
  });

  it('accepts a connection with a valid token', async () => {
    const user = await createUser(ctx.prisma);
    const token = await signAccessToken(ctx.app, user);
    const socket = track(connect(ctx.url, token));
    await expect(waitForConnect(socket)).resolves.toBeUndefined();
  });

  it('delivers a sent message to participants but not to outsiders', async () => {
    const alice = await createUser(ctx.prisma);
    const bob = await createUser(ctx.prisma);
    const carol = await createUser(ctx.prisma);
    await ctx.prisma.friendship.create({
      data: {
        requesterId: alice.id,
        addresseeId: bob.id,
        status: 'accepted',
        acceptedAt: new Date(),
      },
    });
    const conversation = await ctx.app
      .get(ConversationsService)
      .create(alice.id, { participantEmails: [bob.email] });

    const aliceSocket = track(connect(ctx.url, await signAccessToken(ctx.app, alice)));
    const bobSocket = track(connect(ctx.url, await signAccessToken(ctx.app, bob)));
    const carolSocket = track(connect(ctx.url, await signAccessToken(ctx.app, carol)));
    await Promise.all([
      waitForConnect(aliceSocket),
      waitForConnect(bobSocket),
      waitForConnect(carolSocket),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const bobReceives = waitForEvent<{ message: { body: string } }>(
      bobSocket,
      'message.created',
      3000,
    );
    const carolReceives = waitForEvent<unknown>(carolSocket, 'message.created', 1000);

    const ack = await sendMessage(aliceSocket, {
      conversationId: conversation.id,
      body: 'hey bob',
      clientMessageId: randomUUID(),
    });

    expect(ack.ok).toBe(true);
    const delivered = await bobReceives;
    expect(delivered?.message.body).toBe('hey bob');
    expect(await carolReceives).toBeNull();
  });
});
