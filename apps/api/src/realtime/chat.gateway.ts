import { HttpException, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
  type SendMessageAck,
  type ServerToClientEvents,
  type SocketData,
  socketSendMessageSchema,
} from '@yap/contracts';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { MessagesService } from '../messages/messages.service';
import {
  REALTIME_EVENTS,
  type ConversationCreatedEvent,
  type ConversationUpdatedEvent,
  type MessageCreatedEvent,
  type MessageUpdatedEvent,
} from './realtime.events';

type ChatSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type ChatServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

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
    private readonly auth: AuthService,
    private readonly messages: MessagesService,
  ) {}

  afterInit(server: ChatServer): void {
    server.use((socket, next) => {
      void this.authenticate(socket, next);
    });
  }

  private async authenticate(socket: ChatSocket, next: (err?: Error) => void): Promise<void> {
    const token = extractToken(socket);
    if (!token) return next(new Error('Missing auth token'));
    try {
      const payload = await this.auth.verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
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
      const next = await this.auth.verifyAccessToken(payload.accessToken);
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
  ): Promise<SendMessageAck> {
    const userId = client.data.userId;
    if (!userId) return ackError('UNAUTHENTICATED', 'Not authenticated');

    const parsed = socketSendMessageSchema.safeParse(raw);
    if (!parsed.success) {
      return ackError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid payload');
    }
    const { conversationId, ...input } = parsed.data;

    try {
      const message = await this.messages.create(userId, conversationId, input);
      return { ok: true, message };
    } catch (err) {
      const known = extractError(err);
      if (!known) this.logger.warn(`message.send failed: ${(err as Error).message}`);
      return known
        ? ackError(known.code, known.message)
        : ackError('SEND_FAILED', 'Failed to send message');
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

  @OnEvent(REALTIME_EVENTS.messageUpdated)
  onMessageUpdated(event: MessageUpdatedEvent): void {
    const rooms = event.participantUserIds.map(userRoom);
    if (rooms.length === 0) return;
    this.server.to(rooms).emit('message.updated', {
      conversationId: event.message.conversationId,
      message: event.message,
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

function ackError(code: string, message: string): SendMessageAck {
  return { ok: false, error: { code, message } };
}

function extractError(err: unknown): { code: string; message: string } | undefined {
  if (!(err instanceof HttpException)) return undefined;
  const resp = err.getResponse();
  if (typeof resp !== 'object' || resp === null) return undefined;
  const error = (resp as { error?: { code?: unknown; message?: unknown } }).error;
  if (!error || typeof error.code !== 'string') return undefined;
  return {
    code: error.code,
    message: typeof error.message === 'string' ? error.message : error.code,
  };
}
