<script setup lang="ts">
import { SendHorizontal } from 'lucide-vue-next';
import { VALIDATION_LIMITS } from '@yap/contracts';

const props = defineProps<{
  conversationId: string;
}>();

const messages = useMessagesStore();

const draft = ref('');

async function send() {
  const body = draft.value.trim();
  if (!body) return;
  draft.value = '';
  await messages.send(props.conversationId, body);
}
</script>

<template>
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
</template>
