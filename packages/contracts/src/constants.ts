export const PAGINATION = {
  defaultMessageLimit: 50,
  maxMessageLimit: 100,
} as const;

export const VALIDATION_LIMITS = {
  maxMessageBodyLength: 4000,
  maxConversationNameLength: 80,
  maxGroupParticipants: 50,
} as const;
