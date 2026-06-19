<script setup lang="ts">
import type { ConversationDTO } from '@yap/contracts';

const auth = useAuthStore();
const conversations = useConversationsStore();
const messages = useMessagesStore();
const socket = useSocket();

const showNewConversation = ref(false);

useRealtimeSync();

onMounted(async () => {
  await conversations.fetchAll();
});

function onCreated(conv: ConversationDTO) {
  conversations.select(conv.id);
  showNewConversation.value = false;
}

async function handleLogout() {
  socket.disconnect();
  conversations.reset();
  messages.reset();
  await auth.logout();
  await navigateTo('/login');
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
      <h1 class="text-base font-semibold tracking-tight">Yap</h1>
      <div class="flex items-center gap-3">
        <span class="hidden text-sm text-muted-foreground sm:inline">
          {{ auth.user?.displayName }}
        </span>
        <ThemeToggle />
        <button
          type="button"
          class="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          @click="handleLogout"
        >
          Log out
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <ConversationSidebar
        :conversations="conversations.list"
        :selected-id="conversations.selectedId"
        :loading="conversations.loading"
        :current-user-id="auth.user?.id ?? null"
        @select="conversations.select"
        @new-conversation="showNewConversation = true"
      />

      <main class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="!conversations.selected"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          <p>Select a chat or start a new one.</p>
        </div>
        <div v-else class="flex min-h-0 flex-1 flex-col">
          <ConversationHeader :conversation="conversations.selected" />
          <MessageThread :key="conversations.selected.id" :conversation="conversations.selected" />
        </div>
      </main>
    </div>

    <NewConversationModal
      v-if="showNewConversation"
      @close="showNewConversation = false"
      @created="onCreated"
    />

    <DisplayNamePrompt v-if="auth.needsDisplayName" />
  </div>
</template>
