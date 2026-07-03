<script setup lang="ts">
import { Menu, Shield } from 'lucide-vue-next';
import type { ConversationDTO } from '@yap/contracts';

const auth = useAuthStore();
const conversations = useConversationsStore();
const messages = useMessagesStore();
const socket = useSocket();
const sidebar = useSidebarStore();

const showNewConversation = ref(false);
const showProfile = ref(false);
const showAdmin = ref(false);

useRealtimeSync();

onMounted(async () => {
  await conversations.fetchAll();
});

function onCreated(conversation: ConversationDTO) {
  conversations.select(conversation.id);
  showNewConversation.value = false;
  sidebar.close();
}

function resetClient() {
  socket.disconnect();
  conversations.reset();
  messages.reset();
}

async function handleLogout() {
  resetClient();
  await auth.logout();
  await navigateTo('/login');
}

async function handleExitDemo() {
  resetClient();
  await auth.exitDemo();
  await navigateTo('/login');
}
</script>

<template>
  <div class="flex h-screen flex-col">
    <DemoBanner v-if="auth.user?.isGuest" @exit="handleExitDemo" />
    <header class="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
      <h1 class="flex items-center">
        <img src="/yap-logo.png" alt="Yap" class="h-7 w-auto" />
      </h1>
      <div class="flex items-center gap-3">
        <ThemeToggle />
        <button
          v-if="auth.user?.isAdmin"
          type="button"
          class="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Access requests"
          @click="showAdmin = true"
        >
          <Shield class="h-5 w-5" />
        </button>
        <button
          type="button"
          class="flex items-center gap-2 rounded-full p-0.5 pr-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Profile"
          @click="showProfile = true"
        >
          <UserAvatar :name="auth.user?.displayName ?? ''" :src="auth.user?.avatarUrl" :size="28" />
          <span class="hidden sm:inline">{{ auth.user?.displayName }}</span>
        </button>
      </div>
    </header>

    <div class="relative flex min-h-0 flex-1 overflow-hidden">
      <ConversationSidebar
        :conversations="conversations.list"
        :selected-id="conversations.selectedId"
        :loading="conversations.loading"
        :current-user-id="auth.user?.id ?? null"
        @select="conversations.select"
        @new-conversation="showNewConversation = true"
        @toggle-star="conversations.toggleStar"
      />

      <main class="flex min-h-0 min-w-0 flex-1 flex-col">
        <div v-if="!conversations.selected" class="flex min-h-0 flex-1 flex-col">
          <div class="flex items-center border-b border-border bg-card px-4 py-3 md:hidden">
            <button
              type="button"
              class="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Show chats"
              aria-label="Show chats"
              aria-controls="conversation-sidebar"
              :aria-expanded="sidebar.isOpen"
              @click="sidebar.toggle"
            >
              <Menu class="h-5 w-5" />
            </button>
          </div>
          <div class="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            <p>Select a chat or start a new one.</p>
          </div>
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

    <ProfileModal
      v-if="showProfile"
      @close="showProfile = false"
      @logout="
        showProfile = false;
        handleLogout();
      "
      @exit-demo="
        showProfile = false;
        handleExitDemo();
      "
    />

    <AdminPanel v-if="showAdmin && auth.user?.isAdmin" @close="showAdmin = false" />

    <DisplayNamePrompt v-if="auth.needsDisplayName" />
  </div>
</template>
