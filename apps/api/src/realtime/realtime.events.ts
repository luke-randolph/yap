import type { ConversationDTO, MessageDTO } from '@yap/contracts';

export const REALTIME_EVENTS = {
  messageCreated: 'realtime.message.created',
  messageUpdated: 'realtime.message.updated',
  conversationCreated: 'realtime.conversation.created',
  conversationUpdated: 'realtime.conversation.updated',
} as const;

export interface MessageCreatedEvent {
  message: MessageDTO;
  participantUserIds: string[];
  clientMessageId?: string;
}

export interface MessageUpdatedEvent {
  message: MessageDTO;
  participantUserIds: string[];
}

export interface ConversationCreatedEvent {
  conversationByUserId: Map<string, ConversationDTO>;
}

export interface ConversationUpdatedEvent {
  conversationByUserId: Map<string, ConversationDTO>;
}
