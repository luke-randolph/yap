<script setup lang="ts">
import type { ConversationDTO } from '@yap/contracts';
import type { ChatMessage } from '~/stores/messages';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const auth = useAuthStore();
const messages = useMessagesStore();

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

function parentOf(m: ChatMessage): ChatMessage | undefined {
  if (!m.parentMessageId) return undefined;
  return messages.messageById(props.conversation.id, m.parentMessageId);
}

function parentSender(m: ChatMessage): string {
  const p = parentOf(m);
  if (!p) return '';
  return isMine(p.senderId) ? 'You' : senderName(p.senderId);
}

function parentSnippet(m: ChatMessage): string {
  const p = parentOf(m);
  if (!p) return 'Original message unavailable';
  if (p.deletedAt) return 'Deleted message';
  return p.body ?? 'Attachment';
}

async function scrollToBottom() {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
}

watch(
  () => props.conversation.id,
  (id) => {
    messages.clearReplyTarget();
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
      <p
        v-if="loading && items.length === 0"
        class="py-6 text-center text-sm text-muted-foreground"
      >
        Loading messages…
      </p>
      <p v-else-if="items.length === 0" class="py-6 text-center text-sm text-muted-foreground">
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
            class="group flex items-center gap-1"
            :class="isMine(m.senderId) ? 'flex-row-reverse' : 'flex-row'"
          >
            <div
              class="max-w-[75%] rounded-2xl px-3 py-2 text-sm transition-shadow"
              :class="[
                isMine(m.senderId)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
                messages.replyTarget?.id === m.id
                  ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : '',
              ]"
            >
              <p
                v-if="conversation.isGroup && !isMine(m.senderId)"
                class="mb-0.5 text-xs font-medium opacity-70"
              >
                {{ senderName(m.senderId) }}
              </p>
              <div
                v-if="m.parentMessageId"
                class="mb-1 rounded border-l-2 py-1 pl-2 pr-2 text-xs"
                :class="
                  isMine(m.senderId)
                    ? 'border-primary-foreground/60 bg-primary-foreground/15'
                    : 'border-foreground/30 bg-foreground/10'
                "
              >
                <span class="font-medium">{{ parentSender(m) }}</span>
                <span class="block truncate">{{ parentSnippet(m) }}</span>
              </div>
              <p class="whitespace-pre-wrap break-words">{{ m.body }}</p>
            </div>
            <MessageActions
              class="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
              @reply="messages.setReplyTarget(m)"
            />
          </div>
          <span class="mt-0.5 px-1 text-[11px] text-muted-foreground">
            {{ formatTime(m.createdAt) }}
            <template v-if="m.status === 'sending'"> · Sending…</template>
            <template v-else-if="m.status === 'failed'"> · Failed to send</template>
          </span>
        </li>
      </ul>
    </div>

    <MessageComposer :conversation-id="conversation.id" />
  </div>
</template>
