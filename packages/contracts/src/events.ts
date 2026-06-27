import type { ConversationDTO, MessageDTO } from './dtos';

export type SendMessageAck =
  | { ok: true; message: MessageDTO }
  | { ok: false; error: { code: string; message: string } };

export interface ServerToClientEvents {
  'message.created': (payload: {
    conversationId: string;
    message: MessageDTO;
    clientMessageId?: string;
  }) => void;
  'message.updated': (payload: { conversationId: string; message: MessageDTO }) => void;
  'message.deleted': (payload: { conversationId: string; messageId: string }) => void;
  'conversation.created': (payload: { conversation: ConversationDTO }) => void;
  'conversation.updated': (payload: { conversation: ConversationDTO }) => void;
  'conversation.removed': (payload: { conversationId: string }) => void;
}

export interface ClientToServerEvents {
  'message.send': (
    payload: {
      conversationId: string;
      body: string;
      parentMessageId?: string;
      clientMessageId: string;
    },
    ack: (response: SendMessageAck) => void,
  ) => void;
  'auth.refresh': (payload: { accessToken: string }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
