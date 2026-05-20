export interface UserPublicDTO {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ParticipantDTO {
  user: UserPublicDTO;
  joinedAt: string;
  leftAt: string | null;
  lastReadMessageId: string | null;
  isAdmin: boolean;
}

export interface ConversationDTO {
  id: string;
  isGroup: boolean;
  name: string | null;
  displayName: string;
  participants: ParticipantDTO[];
  lastMessageAt: string | null;
  createdAt: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  parentMessageId: string | null;
  attachments: MessageAttachmentDTO[];
  reactions: MessageReactionDTO[];
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface MessageAttachmentDTO {
  id: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
}

export interface MessageReactionDTO {
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  expiresIn: number;
  user: UserPublicDTO;
}
