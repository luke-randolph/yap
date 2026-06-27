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

  function onConversationRemoved(payload: { conversationId: string }) {
    conversations.remove(payload.conversationId);
  }

  function onMessageUpdated(payload: { conversationId: string; message: MessageDTO }) {
    messages.handleUpdated(payload);
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
    sock.on('conversation.removed', onConversationRemoved);
    sock.on('message.created', onMessageCreated);
    sock.on('message.updated', onMessageUpdated);
  });

  onBeforeUnmount(() => {
    const sock = socket.get();
    sock?.off('conversation.created', onConversationCreated);
    sock?.off('conversation.updated', onConversationUpdated);
    sock?.off('conversation.removed', onConversationRemoved);
    sock?.off('message.created', onMessageCreated);
    sock?.off('message.updated', onMessageUpdated);
  });
}
