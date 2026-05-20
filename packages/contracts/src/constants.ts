export const SOCKET_EVENTS = {
  messageSend: 'message.send',
  messageCreated: 'message.created',
  messageUpdated: 'message.updated',
  messageDeleted: 'message.deleted',
  conversationCreated: 'conversation.created',
  participantAdded: 'participant.added',
  participantLeft: 'participant.left',
  authRefresh: 'auth.refresh',
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export const PAGINATION = {
  defaultMessageLimit: 50,
  maxMessageLimit: 100,
} as const;

export const VALIDATION_LIMITS = {
  maxMessageBodyLength: 4000,
  maxConversationNameLength: 80,
  maxGroupParticipants: 50,
} as const;
