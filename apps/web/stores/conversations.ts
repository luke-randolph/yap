import { defineStore } from 'pinia';
import type {
  ConversationDTO,
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

  function addOrReplace(conv: ConversationDTO) {
    const idx = list.value.findIndex((c) => c.id === conv.id);
    if (idx === -1) list.value = [conv, ...list.value];
    else list.value[idx] = conv;
    list.value.sort(sortConversations);
  }

  // Record new activity on a conversation, floating it to the top of the list.
  // No-op if the conversation isn't loaded.
  function markActivity(conversationId: string, at: string) {
    const conv = list.value.find((c) => c.id === conversationId);
    if (!conv) return;
    if (!conv.lastActivityAt || Date.parse(at) > Date.parse(conv.lastActivityAt)) {
      conv.lastActivityAt = at;
      list.value.sort(sortConversations);
    }
  }

  async function create(input: CreateConversationInput): Promise<ConversationDTO> {
    const api = useApi();
    const conv = await api<ConversationDTO>('/conversations', {
      method: 'POST',
      body: input,
    });
    addOrReplace(conv);
    return conv;
  }

  async function update(id: string, input: UpdateConversationInput): Promise<ConversationDTO> {
    const api = useApi();
    const conv = await api<ConversationDTO>(`/conversations/${id}`, {
      method: 'PATCH',
      body: input,
    });
    addOrReplace(conv);
    return conv;
  }

  function select(id: string | null) {
    selectedId.value = id;
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
    create,
    update,
    select,
    reset,
  };
});

function sortConversations(a: ConversationDTO, b: ConversationDTO): number {
  const at = a.lastActivityAt ? Date.parse(a.lastActivityAt) : -Infinity;
  const bt = b.lastActivityAt ? Date.parse(b.lastActivityAt) : -Infinity;
  if (at !== bt) return bt - at;
  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
