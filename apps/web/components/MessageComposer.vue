<script setup lang="ts">
import { Reply, SendHorizontal, Smile, X } from 'lucide-vue-next';
import { onClickOutside, onKeyStroke } from '@vueuse/core';
import { VALIDATION_LIMITS } from '@yap/contracts';

const props = defineProps<{
  conversationId: string;
}>();

const messages = useMessagesStore();
const conversations = useConversationsStore();
const auth = useAuthStore();
const colorMode = useColorMode();
const pickerTheme = computed<'light' | 'dark'>(() =>
  colorMode.value === 'dark' ? 'dark' : 'light',
);

const draft = ref('');

const EmojiPicker = defineAsyncComponent(async () => {
  await import('vue3-emoji-picker/css');
  return (await import('vue3-emoji-picker')).default;
});

const textarea = ref<HTMLTextAreaElement | null>(null);
const emojiRoot = ref<HTMLElement | null>(null);
const emojiOpen = ref(false);

onClickOutside(emojiRoot, () => {
  emojiOpen.value = false;
});

onKeyStroke('Escape', () => {
  if (emojiOpen.value) emojiOpen.value = false;
});

function insertEmoji(emoji: { i: string }) {
  const char = emoji.i;
  const el = textarea.value;
  const start = el?.selectionStart ?? draft.value.length;
  const end = el?.selectionEnd ?? draft.value.length;
  const next = draft.value.slice(0, start) + char + draft.value.slice(end);
  if (next.length > VALIDATION_LIMITS.maxMessageBodyLength) return;
  draft.value = next;
  nextTick(() => {
    const pos = start + char.length;
    el?.focus();
    el?.setSelectionRange(pos, pos);
  });
}

const replyToName = computed(() => {
  const target = messages.replyTarget;
  if (!target) return '';
  if (target.senderId === auth.user?.id) return 'yourself';
  const participants = conversations.selected?.participants ?? [];
  return participants.find((p) => p.user.id === target.senderId)?.user.displayName ?? 'Unknown';
});

const replySnippet = computed(() => messages.replyTarget?.body ?? 'Attachment');

async function send() {
  const body = draft.value.trim();
  if (!body) return;
  const parentMessageId = messages.replyTarget?.id ?? null;
  draft.value = '';
  messages.clearReplyTarget();
  await messages.send(props.conversationId, body, parentMessageId);
}
</script>

<template>
  <form class="border-t border-border bg-card px-4 py-3" @submit.prevent="send">
    <div
      v-if="messages.replyTarget"
      class="mb-2 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
    >
      <Reply class="h-4 w-4 shrink-0 text-accent-foreground/70" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium">Replying to {{ replyToName }}</p>
        <p class="truncate text-xs text-accent-foreground/70">{{ replySnippet }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
        title="Cancel reply"
        @click="messages.clearReplyTarget()"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
    <div class="flex items-end gap-2">
      <div ref="emojiRoot" class="relative self-center">
        <button
          type="button"
          class="flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          title="Emoji"
          @click="emojiOpen = !emojiOpen"
        >
          <Smile class="h-4 w-4" />
        </button>

        <div
          v-if="emojiOpen"
          class="absolute bottom-full left-0 z-10 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <div class="flex items-center justify-end px-2 py-1">
            <button
              type="button"
              class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Close"
              @click="emojiOpen = false"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
          <EmojiPicker
            :native="true"
            :display-recent="true"
            :theme="pickerTheme"
            @select="insertEmoji"
          />
        </div>
      </div>
      <textarea
        ref="textarea"
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
</template>
