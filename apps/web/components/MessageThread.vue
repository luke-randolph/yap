<script setup lang="ts">
import { ChevronDown, Pin, RotateCcw, Trash2 } from 'lucide-vue-next';
import type { ConversationDTO } from '@yap/contracts';
import type { ChatMessage } from '~/stores/messages';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const auth = useAuthStore();
const messages = useMessagesStore();
const toasts = useToastsStore();

const pendingDelete = ref<ChatMessage | null>(null);
const deleting = ref(false);
const highlightedId = ref<string | null>(null);

const scroller = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const hasNewMessages = ref(false);

const items = computed(() => messages.list(props.conversation.id));
const loading = computed(() => messages.isLoading(props.conversation.id));
const loadingOlder = computed(() => messages.isLoadingOlder(props.conversation.id));

const senderById = computed(() => {
  const map = new Map<string, ConversationDTO['participants'][number]['user']>();
  for (const p of props.conversation.participants) map.set(p.user.id, p.user);
  return map;
});

function senderName(senderId: string): string {
  return senderById.value.get(senderId)?.displayName ?? 'Unknown';
}

function senderAvatar(senderId: string): string | null {
  return senderById.value.get(senderId)?.avatarUrl ?? null;
}

function isFromCurrentUser(senderId: string): boolean {
  return senderId === auth.user?.id;
}

function isNotice(m?: ChatMessage): boolean {
  return !!m && (m.type === 'system' || !!m.deletedAt);
}

function unsentLabel(m: ChatMessage): string {
  const who = isFromCurrentUser(m.senderId) ? 'You' : senderName(m.senderId);
  return `${who} unsent a message`;
}

function isFirstInMessageRun(index: number): boolean {
  const prev = items.value[index - 1];
  return index === 0 || prev?.senderId !== items.value[index]?.senderId || isNotice(prev);
}

function isLastInMessageRun(index: number): boolean {
  const next = items.value[index + 1];
  return (
    index === items.value.length - 1 ||
    next?.senderId !== items.value[index]?.senderId ||
    isNotice(next)
  );
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
  return isFromCurrentUser(p.senderId) ? 'You' : senderName(p.senderId);
}

function parentSnippet(m: ChatMessage): string {
  const p = parentOf(m);
  if (!p) return 'Original message unavailable';
  if (p.deletedAt) return 'Deleted message';
  return p.body ?? 'Attachment';
}

// Toggle & replace: re-selecting your current emoji clears it, anything else replaces it.
function toggleReaction(m: ChatMessage, emoji: string): void {
  if (m.id.startsWith('temp-')) return;
  if (messages.currentUserReaction(props.conversation.id, m.id) === emoji) {
    void messages.unreact(props.conversation.id, m.id);
  } else {
    void messages.react(props.conversation.id, m.id, emoji);
  }
}

function retryFailed(m: ChatMessage): void {
  if (m.clientMessageId) void messages.retrySend(props.conversation.id, m.clientMessageId);
}

function discardFailed(m: ChatMessage): void {
  if (m.clientMessageId) messages.discardFailed(props.conversation.id, m.clientMessageId);
}

function togglePin(m: ChatMessage): void {
  if (m.id.startsWith('temp-')) return;
  void messages.setPinned(props.conversation.id, m.id, !m.pinnedAt);
}

async function confirmDelete(): Promise<void> {
  const m = pendingDelete.value;
  if (!m) return;
  deleting.value = true;
  try {
    await messages.deleteMessage(props.conversation.id, m.id);
    pendingDelete.value = null;
  } catch {
    toasts.error("Couldn't unsend message");
  } finally {
    deleting.value = false;
  }
}

async function scrollToBottom(smooth = false) {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
}

async function onScroll() {
  const el = scroller.value;
  if (!el) return;
  isAtBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  if (isAtBottom.value) hasNewMessages.value = false;

  if (el.scrollTop < 200 && messages.canLoadOlder(props.conversation.id) && !loadingOlder.value) {
    const previousHeight = el.scrollHeight;
    await messages.loadOlder(props.conversation.id);
    await nextTick();
    // Older messages were prepended above; offset by their height so the view stays put.
    el.scrollTop = el.scrollHeight - previousHeight;
  }
}

let highlightTimer: ReturnType<typeof setTimeout> | null = null;

async function jumpTo(messageId: string) {
  await nextTick();
  const el = scroller.value?.querySelector(`[data-message-id="${messageId}"]`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (el) {
    highlightedId.value = messageId;
    if (highlightTimer) clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => {
      if (highlightedId.value === messageId) highlightedId.value = null;
    }, 2000);
  }
  messages.clearScrollTarget();
}

watch(
  () => props.conversation.id,
  async (id) => {
    messages.clearReplyTarget();
    isAtBottom.value = true;
    await messages.ensureLoaded(id);
    scrollToBottom();
  },
  { immediate: true },
);

function showLatest() {
  hasNewMessages.value = false;
  scrollToBottom(true);
}

watch(
  () => {
    const last = items.value[items.value.length - 1];
    return last ? (last.clientMessageId ?? last.id) : null;
  },
  (key, prevKey) => {
    if (!key || key === prevKey) return;
    const last = items.value[items.value.length - 1];
    if (!last) return;
    if (isFromCurrentUser(last.senderId) || isAtBottom.value) {
      showLatest();
    } else {
      hasNewMessages.value = true;
    }
  },
);

watch(
  () => {
    const last = items.value[items.value.length - 1];
    return last?.status === 'failed' ? (last.clientMessageId ?? last.id) : null;
  },
  (key) => {
    if (key && isAtBottom.value) scrollToBottom(true);
  },
);

watch(
  () => messages.scrollTarget,
  (id) => {
    if (id) void jumpTo(id);
  },
);
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="relative flex min-h-0 flex-1 flex-col">
      <div
        ref="scroller"
        class="min-h-0 flex-1 overflow-y-auto bg-background px-6 py-4"
        @scroll.passive="onScroll"
      >
        <p
          v-if="loading && items.length === 0"
          class="py-6 text-center text-sm text-muted-foreground"
        >
          Loading messages…
        </p>
        <p v-else-if="items.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          No messages yet. Say hello 👋
        </p>

        <p v-if="loadingOlder" class="py-2 text-center text-sm text-muted-foreground">Loading…</p>

        <ul v-if="items.length > 0" class="flex flex-col gap-2">
          <template v-for="(m, i) in items" :key="m.clientMessageId ?? m.id">
            <li
              v-if="m.deletedAt"
              class="my-1 flex"
              :class="isFromCurrentUser(m.senderId) ? 'justify-end' : 'justify-start'"
            >
              <span class="py-1 text-xs italic text-muted-foreground">
                {{ unsentLabel(m) }}
              </span>
            </li>
            <li v-else-if="m.type === 'system'" class="my-1 flex justify-center">
              <span class="rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                {{ m.body }}
              </span>
            </li>
            <li
              v-else
              :data-message-id="m.id"
              class="flex gap-1"
              :class="isFromCurrentUser(m.senderId) ? 'flex-row-reverse' : 'flex-row'"
            >
              <template v-if="conversation.isGroup && !isFromCurrentUser(m.senderId)">
                <UserAvatar
                  v-if="isLastInMessageRun(i)"
                  :name="senderName(m.senderId)"
                  :src="senderAvatar(m.senderId)"
                  :size="28"
                  class="self-end ring-1 ring-border"
                />
                <span v-else class="w-7 shrink-0" aria-hidden="true" />
              </template>
              <div
                class="flex min-w-0 flex-1 flex-col"
                :class="isFromCurrentUser(m.senderId) ? 'items-end' : 'items-start'"
              >
                <div
                  class="group flex min-w-0 items-center gap-1"
                  :class="isFromCurrentUser(m.senderId) ? 'flex-row-reverse' : 'flex-row'"
                >
                  <div
                    class="min-w-0 max-w-[75%] rounded-3xl border p-3 text-sm transition-shadow"
                    :class="[
                      isFromCurrentUser(m.senderId)
                        ? 'rounded-br-none bg-primary text-primary-foreground'
                        : 'rounded-bl-none bg-card text-foreground',
                      isFromCurrentUser(m.senderId) && messages.replyTarget?.id === m.id
                        ? 'border-gray-800 dark:border-gray-400 shadow-message-highlight'
                        : messages.replyTarget?.id === m.id
                          ? 'border-gray-400 dark:border-primary/50 shadow-message-highlight'
                          : 'border-transparent',
                      highlightedId === m.id ? 'shadow-message-highlight' : '',
                    ]"
                  >
                    <p
                      v-if="
                        conversation.isGroup &&
                        !isFromCurrentUser(m.senderId) &&
                        isFirstInMessageRun(i)
                      "
                      class="mb-0.5 text-xs font-medium opacity-70"
                    >
                      {{ senderName(m.senderId) }}
                    </p>
                    <div
                      v-if="m.parentMessageId"
                      class="mb-1 rounded-md border-l-2 py-1 pl-2 pr-2 text-xs"
                      :class="
                        isFromCurrentUser(m.senderId)
                          ? 'border-primary-foreground/60 bg-primary-foreground/15'
                          : 'border-foreground/30 bg-foreground/10'
                      "
                    >
                      <span class="font-medium">{{ parentSender(m) }}</span>
                      <span class="block truncate">{{ parentSnippet(m) }}</span>
                    </div>
                    <img
                      v-for="att in m.attachments"
                      :key="att.id"
                      :src="att.url"
                      alt="Image attachment"
                      loading="lazy"
                      class="max-h-80 max-w-full rounded-lg object-cover"
                      :class="m.body ? 'mb-1' : ''"
                    />
                    <p v-if="m.body" class="whitespace-pre-wrap wrap-anywhere">{{ m.body }}</p>
                  </div>
                  <MessageActions
                    class="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
                    :align="isFromCurrentUser(m.senderId) ? 'right' : 'left'"
                    :pinned="!!m.pinnedAt"
                    :can-delete="isFromCurrentUser(m.senderId) && !m.id.startsWith('temp-')"
                    @reply="messages.setReplyTarget(m)"
                    @react="toggleReaction(m, $event)"
                    @pin="togglePin(m)"
                    @delete="pendingDelete = m"
                  />
                </div>
                <MessageReactions
                  :reactions="m.reactions"
                  :participants="conversation.participants"
                  @toggle="toggleReaction(m, $event)"
                />
                <span
                  class="px-1 text-xs text-muted-foreground"
                  :class="messages.replyTarget?.id === m.id ? 'mt-2' : 'mt-0.5'"
                >
                  <Pin
                    v-if="m.pinnedAt"
                    class="mr-0.5 inline h-3 w-3 -translate-y-px fill-current text-primary"
                  />
                  {{ formatTime(m.createdAt) }}
                  <template v-if="m.status === 'sending'"> · Sending…</template>
                  <template v-else-if="m.status === 'failed'">
                    · <span class="text-destructive">Failed to send</span>
                  </template>
                </span>
                <div v-if="m.status === 'failed'" class="mt-1 flex gap-1.5">
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                    @click="retryFailed(m)"
                  >
                    <RotateCcw class="h-3 w-3" />
                    Retry
                  </button>
                  <button
                    type="button"
                    class="flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    @click="discardFailed(m)"
                  >
                    <Trash2 class="h-3 w-3" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          </template>
        </ul>
      </div>

      <button
        v-if="hasNewMessages"
        type="button"
        class="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition hover:opacity-90"
        @click="showLatest"
      >
        <ChevronDown class="h-4 w-4" />
        New messages
      </button>
    </div>

    <MessageComposer :conversation-id="conversation.id" />

    <ConfirmModal
      v-if="pendingDelete"
      title="Unsend message?"
      message="This removes the message for everyone. They'll see that a message was unsent."
      confirm-label="Unsend"
      danger
      :loading="deleting"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
