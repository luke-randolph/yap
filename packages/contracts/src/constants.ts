export const PAGINATION = {
  defaultMessageLimit: 50,
  maxMessageLimit: 100,
} as const;

export const VALIDATION_LIMITS = {
  maxMessageBodyLength: 4000,
  maxConversationNameLength: 80,
  maxGroupParticipants: 50,
  maxReactionEmojiLength: 32,
} as const;

export const AVATAR = {
  maxUploadBytes: 5 * 1024 * 1024, // 5 MB raw upload cap
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  outputSize: 256, // square px after processing
} as const;

export const MESSAGE_IMAGE = {
  maxUploadBytes: 10 * 1024 * 1024, // 10 MB raw upload cap
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  maxDimension: 1600, // longest edge (px) after processing
} as const;
