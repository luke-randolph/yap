<script setup lang="ts">
import { PinOff, X } from 'lucide-vue-next';
import type { ConversationDTO } from '@yap/contracts';
import type { ChatMessage } from '~/stores/messages';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const emit = defineEmits<{ close: [] }>();

const messages = useMessagesStore();
const toasts = useToastsStore();

const loading = ref(true);

const senderById = computed(() => {
  const map = new Map<string, ConversationDTO['participants'][number]['user']>();
  for (const p of props.conversation.participants) map.set(p.user.id, p.user);
  return map;
});

const pinned = computed(() =>
  messages
    .list(props.conversation.id)
    .filter((m) => m.pinnedAt)
    .sort((a, b) => Date.parse(b.pinnedAt ?? '') - Date.parse(a.pinnedAt ?? '')),
);

function senderName(senderId: string): string {
  return senderById.value.get(senderId)?.displayName ?? 'Unknown';
}

function snippet(m: ChatMessage): string {
  return m.body ?? (m.attachments.length ? 'Photo' : '');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

async function unpin(m: ChatMessage): Promise<void> {
  await messages.setPinned(props.conversation.id, m.id, false);
}

function jumpTo(m: ChatMessage): void {
  messages.requestScrollTo(m.id);
  emit('close');
}

onMounted(async () => {
  try {
    await messages.fetchPinned(props.conversation.id);
  } catch {
    toasts.error('Could not load pinned messages');
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-lg"
    >
      <div class="flex items-start justify-between p-6 pb-3">
        <div>
          <h2 class="text-lg font-semibold tracking-tight">Pinned messages</h2>
          <p v-if="pinned.length" class="mt-1 text-sm text-muted-foreground">
            {{ pinned.length }} pinned
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <p v-if="loading" class="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        <p v-else-if="pinned.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          No pinned messages yet.
        </p>
        <ul v-else class="space-y-1">
          <li v-for="m in pinned" :key="m.id" class="flex items-start gap-1">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-2 text-left hover:bg-muted"
              @click="jumpTo(m)"
            >
              <UserAvatar
                :name="senderName(m.senderId)"
                :src="senderById.get(m.senderId)?.avatarUrl ?? null"
                :size="32"
                class="mt-0.5 shrink-0 ring-1 ring-border"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-baseline gap-2">
                  <span class="truncate text-sm font-medium">{{ senderName(m.senderId) }}</span>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {{ formatDate(m.createdAt) }}
                  </span>
                </span>
                <span class="block truncate text-sm text-muted-foreground">{{ snippet(m) }}</span>
              </span>
            </button>
            <button
              type="button"
              class="mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Unpin"
              @click="unpin(m)"
            >
              <PinOff class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
