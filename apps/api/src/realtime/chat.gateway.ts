import { HttpException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  type ClientToServerEvents,
  type InterServerEvents,
  type MessageDTO,
  type ServerToClientEvents,
  type SocketData,
  socketSendMessageSchema,
} from '@yap/contracts';
import { Server, Socket } from 'socket.io';
import { type AccessTokenPayload } from '../auth/jwt-auth.guard';
import { MessagesService } from '../messages/messages.service';
import {
  REALTIME_EVENTS,
  type ConversationCreatedEvent,
  type ConversationUpdatedEvent,
  type MessageCreatedEvent,
} from './realtime.events';

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

type SendAck =
  | { ok: true; message: MessageDTO }
  | { ok: false; error: string };

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: ChatServer;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly messages: MessagesService,
  ) {}

  afterInit(server: ChatServer): void {
    server.use(async (socket, next) => {
      const token = extractToken(socket as ChatSocket);
      if (!token) return next(new Error('Missing auth token'));
      try {
        const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
          secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        });
        (socket as ChatSocket).data.userId = payload.sub;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });
  }

  async handleConnection(client: ChatSocket): Promise<void> {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect(true);
      return;
    }
    await client.join(userRoom(userId));
  }

  handleDisconnect(client: ChatSocket): void {
    this.logger.debug(`socket disconnected user=${client.data.userId ?? 'unknown'}`);
  }

  @SubscribeMessage('auth.refresh')
  async onAuthRefresh(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() payload: { accessToken: string },
  ): Promise<void> {
    if (!payload?.accessToken) {
      client.disconnect(true);
      return;
    }
    try {
      const next = await this.jwt.verifyAsync<AccessTokenPayload>(payload.accessToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (client.data.userId && client.data.userId !== next.sub) {
        // Different user on same socket — force a fresh session.
        client.disconnect(true);
        return;
      }
      client.data.userId = next.sub;
      await client.join(userRoom(next.sub));
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('message.send')
  async onMessageSend(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() raw: unknown,
  ): Promise<SendAck> {
    const userId = client.data.userId;
    if (!userId) return ackError('Not authenticated');

    const parsed = socketSendMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return ackError(parsed.error.issues[0]?.message ?? 'Invalid payload');
    }
    const { conversationId, ...input } = parsed.data;

    try {
      const message = await this.messages.create(userId, conversationId, input);
      return { ok: true, message };
    } catch (err) {
      const code = extractErrorCode(err);
      if (!code) this.logger.warn(`message.send failed: ${(err as Error).message}`);
      return ackError(code ?? 'Failed to send message');
    }
  }

  @OnEvent(REALTIME_EVENTS.messageCreated)
  onMessageCreated(event: MessageCreatedEvent): void {
    const rooms = event.participantUserIds.map(userRoom);
    if (rooms.length === 0) return;
    this.server.to(rooms).emit('message.created', {
      conversationId: event.message.conversationId,
      message: event.message,
      clientMessageId: event.clientMessageId,
    });
  }

  @OnEvent(REALTIME_EVENTS.conversationCreated)
  onConversationCreated(event: ConversationCreatedEvent): void {
    for (const [userId, conversation] of event.conversationByUserId) {
      this.server.to(userRoom(userId)).emit('conversation.created', { conversation });
    }
  }

  @OnEvent(REALTIME_EVENTS.conversationUpdated)
  onConversationUpdated(event: ConversationUpdatedEvent): void {
    for (const [userId, conversation] of event.conversationByUserId) {
      this.server.to(userRoom(userId)).emit('conversation.updated', { conversation });
    }
  }
}

function extractToken(client: ChatSocket): string | undefined {
  const auth = client.handshake.auth as { token?: unknown } | undefined;
  if (auth && typeof auth.token === 'string' && auth.token.length > 0) return auth.token;
  return undefined;
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function ackError(error: string): SendAck {
  return { ok: false, error };
}

function extractErrorCode(err: unknown): string | undefined {
  if (!(err instanceof HttpException)) return undefined;
  const resp = err.getResponse();
  if (typeof resp !== 'object' || resp === null) return undefined;
  const code = (resp as { error?: { code?: unknown } }).error?.code;
  return typeof code === 'string' ? code : undefined;
}
