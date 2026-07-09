<script setup lang="ts">
import { getApiError, type ConversationDTO, type UserPublicDTO } from '@yap/contracts';

const props = defineProps<{ conversation: ConversationDTO }>();

const auth = useAuthStore();
const conversations = useConversationsStore();
const friends = useFriendsStore();
const toasts = useToastsStore();

const busy = ref<string | null>(null);
const showBlockConfirm = ref(false);

const sender = computed<UserPublicDTO | null>(
  () => props.conversation.participants.find((p) => p.user.id !== auth.user?.id)?.user ?? null,
);

async function run(key: string, fn: () => Promise<void>, fail: string) {
  if (busy.value) return;
  busy.value = key;
  try {
    await fn();
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? fail);
  } finally {
    busy.value = null;
  }
}

function accept() {
  return run(
    'accept',
    () => conversations.acceptRequest(props.conversation.id).then(() => undefined),
    'Could not accept',
  );
}

function decline() {
  return run(
    'decline',
    () => conversations.declineRequest(props.conversation.id),
    'Could not decline',
  );
}

async function block() {
  const user = sender.value;
  if (!user) return;
  await run(
    'block',
    async () => {
      await friends.block(user);
      await conversations.declineRequest(props.conversation.id);
      toasts.success(`Blocked ${user.displayName}`);
    },
    'Could not block',
  );
  showBlockConfirm.value = false;
}
</script>

<template>
  <div class="border-b border-border bg-accent px-6 py-4 text-center text-accent-foreground">
    <p class="text-sm">
      <span class="font-semibold">{{ sender?.displayName }}</span> wants to message you. Accept to
      reply, or decline to remove this request.
    </p>
    <div class="mt-3 flex flex-wrap justify-center gap-2">
      <button
        type="button"
        :disabled="busy === 'accept'"
        class="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        @click="accept"
      >
        Accept
      </button>
      <button
        type="button"
        :disabled="busy === 'decline'"
        class="rounded-md border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        @click="decline"
      >
        Decline
      </button>
      <button
        type="button"
        :disabled="busy === 'block'"
        class="rounded-md bg-destructive-solid px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        @click="showBlockConfirm = true"
      >
        Block
      </button>
    </div>

    <ConfirmModal
      v-if="showBlockConfirm"
      title="Block user?"
      :message="`${sender?.displayName} won't be able to message you or send you friend requests.`"
      confirm-label="Block"
      danger
      :loading="busy === 'block'"
      @confirm="block"
      @cancel="showBlockConfirm = false"
    />
  </div>
</template>
