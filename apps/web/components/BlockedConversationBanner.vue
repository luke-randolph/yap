<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import { getApiError, type ConversationDTO, type UserPublicDTO } from '@yap/contracts';

const props = defineProps<{ conversation: ConversationDTO }>();

const auth = useAuthStore();
const friends = useFriendsStore();
const conversations = useConversationsStore();
const home = useHomeStore();
const toasts = useToastsStore();

const busy = ref(false);

const other = computed<UserPublicDTO | null>(
  () => props.conversation.participants.find((p) => p.user.id !== auth.user?.id)?.user ?? null,
);

function back() {
  home.tab = 'blocked';
  conversations.select(null);
}

async function unblock() {
  const user = other.value;
  if (!user || busy.value) return;
  busy.value = true;
  try {
    await friends.unblock(user.id);
    toasts.success(`Unblocked ${user.displayName}`);
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not unblock');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-4 py-2.5">
    <button
      type="button"
      class="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      @click="back"
    >
      <ArrowLeft class="h-3.5 w-3.5" />
      Back
    </button>
    <p class="min-w-0 flex-1 text-center text-xs text-muted-foreground">
      You blocked <span class="font-medium text-foreground">{{ other?.displayName }}</span
      >. Unblock to send messages.
    </p>
    <button
      type="button"
      :disabled="busy"
      class="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-background disabled:opacity-50"
      @click="unblock"
    >
      Unblock
    </button>
  </div>
</template>
