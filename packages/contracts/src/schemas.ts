import { z } from 'zod';
import { VALIDATION_LIMITS } from './constants';

export const emailSchema = z.string().email().toLowerCase().trim();

export const requestOtpSchema = z.object({
  email: emailSchema,
});
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const displayNameSchema = z.string().trim().min(1).max(50);

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/, 'OTP code must be 6 digits'),
  displayName: displayNameSchema.optional(),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const AUTH_ERROR_CODES = {
  displayNameRequired: 'DISPLAY_NAME_REQUIRED',
  otpInvalid: 'OTP_INVALID',
  otpTooManyAttempts: 'OTP_TOO_MANY_ATTEMPTS',
  validationError: 'VALIDATION_ERROR',
} as const;

export const CONVERSATION_ERROR_CODES = {
  unknownEmails: 'UNKNOWN_EMAILS',
  conversationNotFound: 'CONVERSATION_NOT_FOUND',
  notParticipant: 'NOT_PARTICIPANT',
  parentMessageNotFound: 'PARENT_MESSAGE_NOT_FOUND',
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

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(VALIDATION_LIMITS.maxMessageBodyLength),
  parentMessageId: z.string().cuid().optional(),
  clientMessageId: z.string().uuid(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const messagesQuerySchema = z.object({
  before: z.string().cuid().optional(),
  after: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MessagesQueryInput = z.infer<typeof messagesQuerySchema>;
