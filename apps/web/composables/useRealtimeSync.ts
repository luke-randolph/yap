import type { ConversationDTO, MessageDTO } from '@yap/contracts';

/**
 * Bridges incoming realtime socket events into the Pinia stores. Call once from
 * a long-lived component (e.g. the chat page); it subscribes on mount and tears
 * the listeners down on unmount.
 */
export function useRealtimeSync(): void {
  const socket = useSocket();
  const auth = useAuthStore();
  const conversations = useConversationsStore();
  const messages = useMessagesStore();

  function onConversationCreated(payload: { conversation: ConversationDTO }) {
    conversations.addOrReplace(payload.conversation);
  }

  function onConversationUpdated(payload: { conversation: ConversationDTO }) {
    conversations.addOrReplace(payload.conversation);
  }

  function onMessageCreated(payload: {
    conversationId: string;
    message: MessageDTO;
    clientMessageId?: string;
  }) {
    messages.handleIncoming(payload);
    conversations.markActivity(payload.conversationId, payload.message.createdAt);
    if (payload.message.senderId !== auth.user?.id) {
      if (payload.conversationId === conversations.selectedId) {
        // Seen live in the open conversation — advance the read marker so it
        // stays read across reloads.
        void conversations.markRead(payload.conversationId);
      } else {
        conversations.markUnread(payload.conversationId);
      }
    }
  }

  onMounted(() => {
    const sock = socket.ensureConnected();
    if (!sock) return;
    sock.on('conversation.created', onConversationCreated);
    sock.on('conversation.updated', onConversationUpdated);
    sock.on('message.created', onMessageCreated);
  });

  onBeforeUnmount(() => {
    const sock = socket.get();
    sock?.off('conversation.created', onConversationCreated);
    sock?.off('conversation.updated', onConversationUpdated);
    sock?.off('message.created', onMessageCreated);
  });
}
