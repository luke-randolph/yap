import { z } from 'zod';
import { VALIDATION_LIMITS } from './constants';

export const emailSchema = z.string().email().toLowerCase().trim();

export const requestOtpSchema = z.object({
  email: emailSchema,
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const displayNameSchema = z.string().trim().min(1).max(50);

export const updateUserSchema = z.object({
  displayName: displayNameSchema,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(50),
});
export type UserSearchQueryInput = z.infer<typeof userSearchQuerySchema>;

export const sendFriendRequestSchema = z.object({
  email: emailSchema,
});
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;

export const FRIEND_ERROR_CODES = {
  cannotFriendSelf: 'CANNOT_FRIEND_SELF',
  friendRequestExists: 'FRIEND_REQUEST_EXISTS',
  alreadyFriends: 'ALREADY_FRIENDS',
  friendshipNotFound: 'FRIENDSHIP_NOT_FOUND',
} as const;

export const USER_ERROR_CODES = {
  userNotFound: 'USER_NOT_FOUND',
  cannotBlockSelf: 'CANNOT_BLOCK_SELF',
} as const;

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP code must be 6 digits'),
  displayName: displayNameSchema.optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const requestAccessSchema = z.object({
  email: emailSchema,
  displayName: displayNameSchema.optional(),
});
export type RequestAccessInput = z.infer<typeof requestAccessSchema>;

export const createAllowedEmailSchema = z.object({
  email: emailSchema,
  note: z.string().trim().max(200).optional(),
});
export type CreateAllowedEmailInput = z.infer<typeof createAllowedEmailSchema>;

export const accessRequestListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'denied', 'all']).default('pending'),
});
export type AccessRequestListQueryInput = z.infer<typeof accessRequestListQuerySchema>;

export const AUTH_ERROR_CODES = {
  displayNameRequired: 'DISPLAY_NAME_REQUIRED',
  otpInvalid: 'OTP_INVALID',
  otpTooManyAttempts: 'OTP_TOO_MANY_ATTEMPTS',
  validationError: 'VALIDATION_ERROR',
  emailNotAllowlisted: 'EMAIL_NOT_ALLOWLISTED',
  accessRequestPending: 'ACCESS_REQUEST_PENDING',
} as const;

export const CONVERSATION_ERROR_CODES = {
  unknownEmails: 'UNKNOWN_EMAILS',
  conversationNotFound: 'CONVERSATION_NOT_FOUND',
  notParticipant: 'NOT_PARTICIPANT',
  notGroupConversation: 'NOT_GROUP_CONVERSATION',
  participantsBlocked: 'PARTICIPANTS_BLOCKED',
  notBlocked: 'NOT_BLOCKED',
  notRequest: 'NOT_REQUEST',
  parentMessageNotFound: 'PARENT_MESSAGE_NOT_FOUND',
  messageNotFound: 'MESSAGE_NOT_FOUND',
  notMessageOwner: 'NOT_MESSAGE_OWNER',
  recipientsNotAllowed: 'RECIPIENTS_NOT_ALLOWED',
} as const;

export const createConversationSchema = z
  .object({
    participantEmails: z.array(emailSchema).min(1).max(VALIDATION_LIMITS.maxGroupParticipants),
    name: z.string().trim().max(VALIDATION_LIMITS.maxConversationNameLength).optional(),
  })
  .refine((v) => !v.name || v.participantEmails.length >= 2, {
    message: 'Name is only valid for group conversations',
    path: ['name'],
  });
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z.object({
  name: z.string().trim().min(1).max(VALIDATION_LIMITS.maxConversationNameLength),
});
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

export const addParticipantsSchema = z.object({
  participantEmails: z.array(emailSchema).min(1).max(VALIDATION_LIMITS.maxGroupParticipants),
});
export type AddParticipantsInput = z.infer<typeof addParticipantsSchema>;

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(VALIDATION_LIMITS.maxMessageBodyLength),
  parentMessageId: z.string().cuid().optional(),
  clientMessageId: z.string().uuid(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const sendImageMessageSchema = z.object({
  body: z.string().trim().max(VALIDATION_LIMITS.maxMessageBodyLength).optional(),
  parentMessageId: z.string().cuid().optional(),
  clientMessageId: z.string().uuid(),
});
export type SendImageMessageInput = z.infer<typeof sendImageMessageSchema>;

export const socketSendMessageSchema = sendMessageSchema.extend({
  conversationId: z.string().cuid(),
});
export type SocketSendMessageInput = z.infer<typeof socketSendMessageSchema>;

export const gifSearchQuerySchema = z.object({
  q: z.string().trim().max(50).optional(),
  pos: z.string().trim().max(100).optional(),
});
export type GifSearchQueryInput = z.infer<typeof gifSearchQuerySchema>;

export const sendGifMessageSchema = z.object({
  gifId: z.string().trim().min(1).max(100),
  body: z.string().trim().max(VALIDATION_LIMITS.maxMessageBodyLength).optional(),
  parentMessageId: z.string().cuid().optional(),
  clientMessageId: z.string().uuid(),
});
export type SendGifMessageInput = z.infer<typeof sendGifMessageSchema>;

export const reactMessageSchema = z.object({
  emoji: z.string().trim().min(1).max(VALIDATION_LIMITS.maxReactionEmojiLength),
});
export type ReactMessageInput = z.infer<typeof reactMessageSchema>;

export const messagesQuerySchema = z.object({
  before: z.string().cuid().optional(),
  after: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
