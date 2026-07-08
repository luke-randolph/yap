import { defineStore } from 'pinia';
import type {
  ConversationDTO,
  ConversationParticipantsDTO,
  CreateConversationInput,
  UpdateConversationInput,
} from '@yap/contracts';

export const useConversationsStore = defineStore('conversations', () => {
  const list = ref<ConversationDTO[]>([]);
  const selectedId = ref<string | null>(null);
  const loaded = ref(false);
  const loading = ref(false);

  const selected = computed(() => list.value.find((c) => c.id === selectedId.value) ?? null);

  async function fetchAll() {
    if (loading.value) return;
    loading.value = true;
    try {
      const api = useApi();
      list.value = await api<ConversationDTO[]>('/conversations');
      list.value.sort(sortConversations);
      loaded.value = true;
    } finally {
      loading.value = false;
    }
  }

  function addOrReplace(conversation: ConversationDTO) {
    const idx = list.value.findIndex((c) => c.id === conversation.id);
    if (idx === -1) list.value = [conversation, ...list.value];
    else list.value[idx] = conversation;
    list.value.sort(sortConversations);
  }

  // Record new activity on a conversation, floating it to the top of the list.
  // No-op if the conversation isn't loaded.
  function markActivity(conversationId: string, at: string) {
    const conversation = list.value.find((c) => c.id === conversationId);
    if (!conversation) return;
    if (!conversation.lastActivityAt || Date.parse(at) > Date.parse(conversation.lastActivityAt)) {
      conversation.lastActivityAt = at;
      list.value.sort(sortConversations);
    }
  }

  async function create(input: CreateConversationInput): Promise<ConversationDTO> {
    const api = useApi();
    const conversation = await api<ConversationDTO>('/conversations', {
      method: 'POST',
      body: input,
    });
    addOrReplace(conversation);
    return conversation;
  }

  async function update(id: string, input: UpdateConversationInput): Promise<ConversationDTO> {
    const api = useApi();
    const conversation = await api<ConversationDTO>(`/conversations/${id}`, {
      method: 'PATCH',
      body: input,
    });
    addOrReplace(conversation);
    return conversation;
  }

  function remove(id: string) {
    list.value = list.value.filter((c) => c.id !== id);
    if (selectedId.value === id) selectedId.value = null;
  }

  async function fetchParticipants(id: string): Promise<ConversationParticipantsDTO> {
    const api = useApi();
    return api<ConversationParticipantsDTO>(`/conversations/${id}/participants`);
  }

  async function addParticipants(id: string, emails: string[]): Promise<ConversationDTO> {
    const api = useApi();
    const conversation = await api<ConversationDTO>(`/conversations/${id}/participants`, {
      method: 'POST',
      body: { participantEmails: emails },
    });
    addOrReplace(conversation);
    return conversation;
  }

  async function leave(id: string) {
    const api = useApi();
    await api(`/conversations/${id}/leave`, { method: 'POST' });
    remove(id);
  }

  async function block(id: string) {
    const api = useApi();
    await api(`/conversations/${id}/block`, { method: 'POST' });
    remove(id);
  }

  async function acceptRequest(id: string): Promise<ConversationDTO> {
    const api = useApi();
    const conversation = await api<ConversationDTO>(`/conversations/${id}/accept-request`, {
      method: 'POST',
    });
    addOrReplace(conversation);
    return conversation;
  }

  async function declineRequest(id: string) {
    const api = useApi();
    await api(`/conversations/${id}/decline-request`, { method: 'POST' });
    remove(id);
  }

  async function fetchBlocked(): Promise<ConversationDTO[]> {
    const api = useApi();
    return api<ConversationDTO[]>('/conversations/blocked');
  }

  async function unblock(id: string) {
    const api = useApi();
    await api(`/conversations/${id}/unblock`, { method: 'POST' });
  }

  function markUnread(conversationId: string) {
    if (conversationId === selectedId.value) return;
    const conversation = list.value.find((c) => c.id === conversationId);
    if (conversation) conversation.hasUnreadMessages = true;
  }

  async function markRead(conversationId: string) {
    const conversation = list.value.find((c) => c.id === conversationId);
    if (conversation) conversation.hasUnreadMessages = false;
    try {
      const api = useApi();
      await api(`/conversations/${conversationId}/markRead`, { method: 'POST' });
    } catch {
      // Best-effort; the flag re-derives from the server on next load.
    }
  }

  async function toggleStar(conversationId: string) {
    const conversation = list.value.find((c) => c.id === conversationId);
    if (!conversation) return;
    const starred = !conversation.isStarred;
    conversation.isStarred = starred;
    list.value.sort(sortConversations);
    try {
      const api = useApi();
      await api(`/conversations/${conversationId}/star`, {
        method: starred ? 'POST' : 'DELETE',
      });
    } catch {
      conversation.isStarred = !starred;
      list.value.sort(sortConversations);
    }
  }

  function select(id: string | null) {
    selectedId.value = id;
    if (id) void markRead(id);
  }

  function reset() {
    list.value = [];
    selectedId.value = null;
    loaded.value = false;
  }

  return {
    list,
    selectedId,
    selected,
    loaded,
    loading,
    fetchAll,
    addOrReplace,
    markActivity,
    markUnread,
    markRead,
    toggleStar,
    create,
    update,
    remove,
    fetchParticipants,
    addParticipants,
    leave,
    block,
    acceptRequest,
    declineRequest,
    fetchBlocked,
    unblock,
    select,
    reset,
  };
});

function sortConversations(a: ConversationDTO, b: ConversationDTO): number {
  if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1;
  const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : -Infinity;
  const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : -Infinity;
  if (at !== bt) return bt - at;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
