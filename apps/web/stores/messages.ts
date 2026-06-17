import { defineStore } from 'pinia';
import { PAGINATION, type MessageDTO } from '@yap/contracts';

export type SendStatus = 'sending' | 'sent' | 'failed';

export interface ChatMessage extends MessageDTO {
  clientMessageId?: string;
  status?: SendStatus;
}

export const useMessagesStore = defineStore('messages', () => {
  const byConversation = ref<Record<string, ChatMessage[]>>({});
  const loaded = ref<Record<string, boolean>>({});
  const loading = ref<Record<string, boolean>>({});

  function list(conversationId: string): ChatMessage[] {
    return byConversation.value[conversationId] ?? [];
  }

  function isLoading(conversationId: string): boolean {
    return !!loading.value[conversationId];
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
      // oldest-first, so reverse before merging.
      upsertMany(conversationId, [...rows].reverse());
      loaded.value[conversationId] = true;
    } finally {
      loading.value[conversationId] = false;
    }
  }

  async function send(conversationId: string, body: string): Promise<void> {
    const auth = useAuthStore();
    const clientMessageId = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id: `temp-${clientMessageId}`,
      conversationId,
      senderId: auth.user?.id ?? '',
      body,
      parentMessageId: null,
      attachments: [],
      reactions: [],
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      clientMessageId,
      status: 'sending',
    };
    upsert(conversationId, optimistic);

    const socket = useSocket().ensureConnected();
    if (socket) {
      socket.emit('message.send', { conversationId, body, clientMessageId }, (res) => {
        if (res.ok) upsert(conversationId, { ...res.message, clientMessageId, status: 'sent' });
        else setStatus(conversationId, clientMessageId, 'failed');
      });
      return;
    }

    // No live socket — fall back to the REST endpoint.
    try {
      const api = useApi();
      const msg = await api<MessageDTO>(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { body, clientMessageId },
      });
      upsert(conversationId, { ...msg, clientMessageId, status: 'sent' });
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

  function reset(): void {
    byConversation.value = {};
    loaded.value = {};
    loading.value = {};
  }

  function bucket(conversationId: string): ChatMessage[] {
    if (!byConversation.value[conversationId]) byConversation.value[conversationId] = [];
    return byConversation.value[conversationId];
  }

  // Insert or replace a message, matching first on clientMessageId (to reconcile
  // an optimistic send) then on server id (idempotent across ack + broadcast).
  function upsert(conversationId: string, msg: ChatMessage): void {
    const items = bucket(conversationId);
    let idx = -1;
    if (msg.clientMessageId) {
      idx = items.findIndex((m) => m.clientMessageId && m.clientMessageId === msg.clientMessageId);
    }
    if (idx === -1) idx = items.findIndex((m) => m.id === msg.id);
    if (idx === -1) items.push(msg);
    else items[idx] = { ...items[idx], ...msg };
    items.sort(byTime);
  }

  function upsertMany(conversationId: string, msgs: MessageDTO[]): void {
    for (const m of msgs) upsert(conversationId, m);
  }

  function setStatus(conversationId: string, clientMessageId: string, status: SendStatus): void {
    const items = bucket(conversationId);
    const found = items.find((m) => m.clientMessageId === clientMessageId);
    if (found) found.status = status;
  }

  return {
    list,
    isLoading,
    ensureLoaded,
    fetchHistory,
    send,
    handleIncoming,
    reset,
  };
});

function byTime(a: MessageDTO, b: MessageDTO): number {
  const at = Date.parse(a.createdAt);
  const bt = Date.parse(b.createdAt);
  if (at !== bt) return at - bt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
