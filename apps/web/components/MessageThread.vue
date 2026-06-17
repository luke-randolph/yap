<script setup lang="ts">
import { SendHorizontal } from 'lucide-vue-next';
import { VALIDATION_LIMITS, type ConversationDTO } from '@yap/contracts';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const auth = useAuthStore();
const messages = useMessagesStore();

const draft = ref('');
const scroller = ref<HTMLElement | null>(null);

const items = computed(() => messages.list(props.conversation.id));
const loading = computed(() => messages.isLoading(props.conversation.id));

const senderNames = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.conversation.participants) map.set(p.user.id, p.user.displayName);
  return map;
});

function senderName(senderId: string): string {
  return senderNames.value.get(senderId) ?? 'Unknown';
}

function isMine(senderId: string): boolean {
  return senderId === auth.user?.id;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function scrollToBottom() {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function send() {
  const body = draft.value.trim();
  if (!body) return;
  draft.value = '';
  await messages.send(props.conversation.id, body);
}

watch(
  () => props.conversation.id,
  (id) => {
    messages.ensureLoaded(id);
    scrollToBottom();
  },
  { immediate: true },
);

watch(() => items.value.length, scrollToBottom);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
      <p v-if="loading && items.length === 0" class="py-6 text-center text-sm text-muted-foreground">
        Loading messages…
      </p>
      <p
        v-else-if="items.length === 0"
        class="py-6 text-center text-sm text-muted-foreground"
      >
        No messages yet. Say hello 👋
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="m in items"
          :key="m.clientMessageId ?? m.id"
          class="flex flex-col"
          :class="isMine(m.senderId) ? 'items-end' : 'items-start'"
        >
          <div
            class="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
            :class="isMine(m.senderId)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'"
          >
            <p
              v-if="conversation.isGroup && !isMine(m.senderId)"
              class="mb-0.5 text-xs font-medium opacity-70"
            >
              {{ senderName(m.senderId) }}
            </p>
            <p class="whitespace-pre-wrap break-words">{{ m.body }}</p>
          </div>
          <span class="mt-0.5 px-1 text-[11px] text-muted-foreground">
            {{ formatTime(m.createdAt) }}
            <template v-if="m.status === 'sending'"> · Sending…</template>
            <template v-else-if="m.status === 'failed'"> · Failed to send</template>
          </span>
        </li>
      </ul>
    </div>

    <form class="border-t border-border bg-card px-4 py-3" @submit.prevent="send">
      <div class="flex items-end gap-2">
        <textarea
          v-model="draft"
          rows="1"
          :maxlength="VALIDATION_LIMITS.maxMessageBodyLength"
          placeholder="Type a message…"
          class="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          @keydown.enter.exact.prevent="send"
        />
        <button
          type="submit"
          :disabled="!draft.trim()"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          title="Send"
        >
          <SendHorizontal class="h-4 w-4" />
        </button>
      </div>
    </form>
  </div>
</template>
