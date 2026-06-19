<script setup lang="ts">
import { Reply, SendHorizontal, X } from 'lucide-vue-next';
import { VALIDATION_LIMITS } from '@yap/contracts';

const props = defineProps<{
  conversationId: string;
}>();

const messages = useMessagesStore();
const conversations = useConversationsStore();
const auth = useAuthStore();

const draft = ref('');

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
      class="mb-2 flex items-center gap-2 rounded-md bg-violet-100 px-3 py-2 text-sm"
    >
      <Reply class="h-4 w-4 shrink-0 text-muted-foreground" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium">Replying to {{ replyToName }}</p>
        <p class="truncate text-xs text-muted-foreground">{{ replySnippet }}</p>
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
</template>
