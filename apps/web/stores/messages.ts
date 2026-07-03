import { defineStore } from 'pinia';
import { PAGINATION, type MessageDTO } from '@yap/contracts';

export type SendStatus = 'sending' | 'sent' | 'failed';

// How long to wait for the server's send ack before marking a message failed,
// so a dropped ack doesn't leave the bubble stuck on "Sending…".
const SEND_ACK_TIMEOUT_MS = 10_000;

export interface ChatMessage extends MessageDTO {
  clientMessageId?: string;
  status?: SendStatus;
}

export const useMessagesStore = defineStore('messages', () => {
  const byConversation = ref<Record<string, ChatMessage[]>>({});
  const loaded = ref<Record<string, boolean>>({});
  const loading = ref<Record<string, boolean>>({});
  const hasMore = ref<Record<string, boolean>>({});
  const loadingOlder = ref<Record<string, boolean>>({});

  // Message the composer is replying to; cleared on conversation switch.
  const replyTarget = ref<ChatMessage | null>(null);

  // Message id the thread should scroll to (e.g. tapped from the pinned modal).
  const scrollTarget = ref<string | null>(null);

  function list(conversationId: string): ChatMessage[] {
    return byConversation.value[conversationId] ?? [];
  }

  function messageById(conversationId: string, id: string): ChatMessage | undefined {
    return byConversation.value[conversationId]?.find((m) => m.id === id);
  }

  function currentUserReaction(conversationId: string, messageId: string): string | undefined {
    const userId = useAuthStore().user?.id;
    if (!userId) return undefined;
    const msg = messageById(conversationId, messageId);
    return msg?.reactions.find((r) => r.userId === userId)?.emoji;
  }

  function setReplyTarget(msg: ChatMessage): void {
    replyTarget.value = msg;
  }

  function clearReplyTarget(): void {
    replyTarget.value = null;
  }

  function requestScrollTo(messageId: string): void {
    scrollTarget.value = messageId;
  }

  function clearScrollTarget(): void {
    scrollTarget.value = null;
  }

  function isLoading(conversationId: string): boolean {
    return !!loading.value[conversationId];
  }

  function isLoadingOlder(conversationId: string): boolean {
    return !!loadingOlder.value[conversationId];
  }

  function canLoadOlder(conversationId: string): boolean {
    return !!hasMore.value[conversationId];
  }

  async function ensureLoaded(conversationId: string): Promise<void> {
    if (loaded.value[conversationId] || loading.value[conversationId]) return;
    await fetchHistory(conversationId);
  }

  async function fetchHistory(conversationId: string): Promise<void> {
    if (loading.value[conversationId]) return;
    loading.value[conversationId] = true;
    try {
      const api = useApi();
      const rows = await api<MessageDTO[]>(`/conversations/${conversationId}/messages`, {
        query: { limit: PAGINATION.defaultMessageLimit },
      });
      // The API returns newest-first for a default (`before`) query; we render
      // oldest-first, so reverse before merging into store.
      upsertMany(conversationId, [...rows].reverse());
      loaded.value[conversationId] = true;
      hasMore.value[conversationId] = rows.length >= PAGINATION.defaultMessageLimit;
    } finally {
      loading.value[conversationId] = false;
    }
  }

  async function loadOlder(conversationId: string): Promise<void> {
    if (loadingOlder.value[conversationId] || !hasMore.value[conversationId]) return;
    const oldest = byConversation.value[conversationId]?.find((m) => !m.id.startsWith('temp-'));
    if (!oldest) return;

    loadingOlder.value[conversationId] = true;
    try {
      const api = useApi();
      const rows = await api<MessageDTO[]>(`/conversations/${conversationId}/messages`, {
        query: { before: oldest.id, limit: PAGINATION.defaultMessageLimit },
      });
      upsertMany(conversationId, rows);
      hasMore.value[conversationId] = rows.length >= PAGINATION.defaultMessageLimit;
    } finally {
      loadingOlder.value[conversationId] = false;
    }
  }

  async function send(
    conversationId: string,
    body: string,
    parentMessageId: string | null = null,
  ): Promise<void> {
    const auth = useAuthStore();
    const clientMessageId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: `temp-${clientMessageId}`,
      conversationId,
      senderId: auth.user?.id ?? '',
      type: 'user',
      body,
      parentMessageId,
      attachments: [],
      reactions: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      pinnedAt: null,
      clientMessageId,
      status: 'sending',
    };
    upsert(conversationId, optimistic);

    const socket = useSocket().ensureConnected();
    if (socket) {
      socket
        .timeout(SEND_ACK_TIMEOUT_MS)
        .emit(
          'message.send',
          { conversationId, body, clientMessageId, parentMessageId: parentMessageId ?? undefined },
          (err, res) => {
            if (err || !res.ok) {
              setStatus(conversationId, clientMessageId, 'failed');
              return;
            }
            upsert(conversationId, { ...res.message, clientMessageId, status: 'sent' });
          },
        );
      return;
    }

    // No live socket — fall back to the REST endpoint.
    try {
      const api = useApi();
      const msg = await api<MessageDTO>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body, clientMessageId, parentMessageId: parentMessageId ?? undefined },
      });
      upsert(conversationId, { ...msg, clientMessageId, status: 'sent' });
    } catch {
      setStatus(conversationId, clientMessageId, 'failed');
    }
  }

  async function sendImage(
    conversationId: string,
    file: File,
    body: string,
    parentMessageId: string | null = null,
  ): Promise<void> {
    const auth = useAuthStore();
    const clientMessageId = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    const optimistic: ChatMessage = {
      id: `temp-${clientMessageId}`,
      conversationId,
      senderId: auth.user?.id ?? '',
      type: 'user',
      body: body || null,
      parentMessageId,
      attachments: [
        {
          id: `temp-att-${clientMessageId}`,
          url: previewUrl,
          mimeType: file.type,
          width: null,
          height: null,
          sizeBytes: file.size,
        },
      ],
      reactions: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      pinnedAt: null,
      clientMessageId,
      status: 'sending',
    };
    upsert(conversationId, optimistic);

    try {
      const api = useApi();
      const form = new FormData();
      form.append('file', file);
      if (body) form.append('body', body);
      if (parentMessageId) form.append('parentMessageId', parentMessageId);
      form.append('clientMessageId', clientMessageId);
      const msg = await api<MessageDTO>(`/conversations/${conversationId}/messages/image`, {
        method: 'POST',
        body: form,
      });
      upsert(conversationId, { ...msg, clientMessageId, status: 'sent' });
      URL.revokeObjectURL(previewUrl);
    } catch {
      setStatus(conversationId, clientMessageId, 'failed');
    }
  }

  function handleIncoming(payload: {
    conversationId: string;
    message: MessageDTO;
    clientMessageId?: string;
  }): void {
    upsert(payload.conversationId, {
      ...payload.message,
      clientMessageId: payload.clientMessageId,
      status: 'sent',
    });
  }

  // Set/replace the current user's reaction, optimistically; roll back on failure.
  async function react(conversationId: string, messageId: string, emoji: string): Promise<void> {
    const userId = useAuthStore().user?.id;
    const msg = messageById(conversationId, messageId);
    if (!userId || !msg) return;

    const previous = msg.reactions;
    msg.reactions = [
      ...previous.filter((r) => r.userId !== userId),
      { userId, emoji, createdAt: new Date().toISOString() },
    ];

    try {
      const api = useApi();
      const updated = await api<MessageDTO>(
        `/conversations/${conversationId}/messages/${messageId}/reactions`,
        { method: 'POST', body: { emoji } },
      );
      upsert(conversationId, { ...updated, status: 'sent' });
    } catch {
      msg.reactions = previous;
      useToastsStore().error("Couldn't add reaction");
    }
  }

  // Remove the current user's reaction, optimistically; roll back on failure.
  async function unreact(conversationId: string, messageId: string): Promise<void> {
    const userId = useAuthStore().user?.id;
    const msg = messageById(conversationId, messageId);
    if (!userId || !msg) return;

    const previous = msg.reactions;
    msg.reactions = previous.filter((r) => r.userId !== userId);

    try {
      const api = useApi();
      const updated = await api<MessageDTO>(
        `/conversations/${conversationId}/messages/${messageId}/reactions`,
        { method: 'DELETE' },
      );
      upsert(conversationId, { ...updated, status: 'sent' });
    } catch {
      msg.reactions = previous;
      useToastsStore().error("Couldn't remove reaction");
    }
  }

  function handleUpdated(payload: { conversationId: string; message: MessageDTO }): void {
    upsert(payload.conversationId, { ...payload.message, status: 'sent' });
  }

  function handleDeleted(payload: { conversationId: string; messageId: string }): void {
    dropMessage(payload.conversationId, payload.messageId);
  }

  // Pin or unpin a message optimistically; roll back on failure.
  async function setPinned(
    conversationId: string,
    messageId: string,
    pinned: boolean,
  ): Promise<void> {
    const msg = messageById(conversationId, messageId);
    if (!msg || messageId.startsWith('temp-')) return;

    const previous = msg.pinnedAt;
    msg.pinnedAt = pinned ? new Date().toISOString() : null;

    try {
      const api = useApi();
      const updated = await api<MessageDTO>(
        `/conversations/${conversationId}/messages/${messageId}/pin`,
        { method: pinned ? 'POST' : 'DELETE' },
      );
      upsert(conversationId, { ...updated, status: 'sent' });
    } catch {
      msg.pinnedAt = previous;
      useToastsStore().error(pinned ? "Couldn't pin message" : "Couldn't unpin message");
    }
  }

  async function fetchPinned(conversationId: string): Promise<void> {
    const api = useApi();
    const rows = await api<MessageDTO[]>(`/conversations/${conversationId}/messages/pinned`);
    upsertMany(conversationId, rows);
  }

  async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
    if (messageId.startsWith('temp-')) return;
    const api = useApi();
    await api(`/conversations/${conversationId}/messages/${messageId}`, { method: 'DELETE' });
    dropMessage(conversationId, messageId);
  }

  function dropMessage(conversationId: string, messageId: string): void {
    const items = byConversation.value[conversationId];
    if (!items) return;
    const idx = items.findIndex((m) => m.id === messageId);
    if (idx !== -1) items.splice(idx, 1);
  }

  function reset(): void {
    byConversation.value = {};
    loaded.value = {};
    loading.value = {};
    hasMore.value = {};
    loadingOlder.value = {};
    replyTarget.value = null;
    scrollTarget.value = null;
  }

  function bucket(conversationId: string): ChatMessage[] {
    if (!byConversation.value[conversationId]) byConversation.value[conversationId] = [];
    return byConversation.value[conversationId];
  }

  // Insert or replace a message, matching first on clientMessageId (to reconcile
  // an optimistic send) then on server id (idempotent across ack + broadcast).
  function upsert(conversationId: string, msg: ChatMessage, sort = true): void {
    const items = bucket(conversationId);
    let idx = -1;
    if (msg.clientMessageId) {
      idx = items.findIndex((m) => m.clientMessageId && m.clientMessageId === msg.clientMessageId);
    }
    if (idx === -1) idx = items.findIndex((m) => m.id === msg.id);
    if (idx === -1) items.push(msg);
    else items[idx] = { ...items[idx], ...msg };
    if (sort) items.sort(byTime);
  }

  function upsertMany(conversationId: string, msgs: MessageDTO[]): void {
    for (const m of msgs) upsert(conversationId, m, false);
    bucket(conversationId).sort(byTime);
  }

  function setStatus(conversationId: string, clientMessageId: string, status: SendStatus): void {
    const items = bucket(conversationId);
    const found = items.find((m) => m.clientMessageId === clientMessageId);
    if (found) found.status = status;
  }

  return {
    list,
    messageById,
    currentUserReaction,
    replyTarget,
    setReplyTarget,
    clearReplyTarget,
    scrollTarget,
    requestScrollTo,
    clearScrollTarget,
    isLoading,
    isLoadingOlder,
    canLoadOlder,
    ensureLoaded,
    fetchHistory,
    loadOlder,
    send,
    sendImage,
    react,
    unreact,
    setPinned,
    fetchPinned,
    deleteMessage,
    handleIncoming,
    handleUpdated,
    handleDeleted,
    reset,
  };
});

function byTime(a: MessageDTO, b: MessageDTO): number {
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (at !== bt) return at - bt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
