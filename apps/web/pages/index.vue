<script setup lang="ts">
import { Check, Pencil, X } from 'lucide-vue-next';
import type { ConversationDTO, MessageDTO } from '@yap/contracts';

const auth = useAuthStore();
const conversations = useConversationsStore();
const messages = useMessagesStore();
const socket = useSocket();

const showNewChat = ref(false);

const editingName = ref(false);
const nameDraft = ref('');
const savingName = ref(false);
const nameError = ref<string | null>(null);

onMounted(async () => {
  await conversations.fetchAll();
  const sock = socket.ensureConnected();
  if (!sock) return;
  sock.on('conversation.created', onConversationCreated);
  sock.on('conversation.updated', onConversationUpdated);
  sock.on('message.created', onMessageCreated);
});

onBeforeUnmount(() => {
  const sock = socket.get();
  sock?.off('conversation.created', onConversationCreated);
  sock?.off('conversation.updated', onConversationUpdated);
  sock?.off('message.created', onMessageCreated);
});

function onConversationCreated(payload: { conversation: ConversationDTO }) {
  conversations.addOrReplace(payload.conversation);
}

function onConversationUpdated(payload: { conversation: ConversationDTO }) {
  conversations.addOrReplace(payload.conversation);
}

function onMessageCreated(payload: {
  conversationId: string;
  message: MessageDTO;
  clientMessageId?: string;
}) {
  messages.handleIncoming(payload);
}

function onCreated(conv: ConversationDTO) {
  conversations.select(conv.id);
  showNewChat.value = false;
}

function startEditName() {
  const selected = conversations.selected;
  if (!selected) return;
  nameDraft.value = selected.name ?? selected.displayName;
  nameError.value = null;
  editingName.value = true;
}

function cancelEditName() {
  editingName.value = false;
  nameError.value = null;
}

async function saveName() {
  const selected = conversations.selected;
  if (!selected) return;
  const trimmed = nameDraft.value.trim();
  if (!trimmed) {
    nameError.value = 'Name cannot be empty';
    return;
  }
  if (trimmed === selected.name) {
    editingName.value = false;
    return;
  }
  savingName.value = true;
  nameError.value = null;
  try {
    await conversations.update(selected.id, { name: trimmed });
    editingName.value = false;
  } catch (e) {
    nameError.value = extractMessage(e) ?? 'Could not rename chat';
  } finally {
    savingName.value = false;
  }
}

function extractMessage(e: unknown): string | null {
  return (e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? null;
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
        @new-chat="showNewChat = true"
      />

      <main class="flex min-h-0 flex-1 flex-col">
        <div
          v-if="!conversations.selected"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          <p>Select a chat or start a new one.</p>
        </div>
        <div v-else class="flex min-h-0 flex-1 flex-col">
          <header class="border-b border-border bg-card px-6 py-3">
            <div v-if="editingName" class="flex items-center gap-2">
              <input
                v-model="nameDraft"
                type="text"
                autofocus
                :maxlength="80"
                class="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-base outline-none focus:border-primary"
                @keydown.enter.prevent="saveName"
                @keydown.esc="cancelEditName"
              />
              <button
                type="button"
                class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Save"
                :disabled="savingName"
                @click="saveName"
              >
                <Check class="h-4 w-4" />
              </button>
              <button
                type="button"
                class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Cancel"
                @click="cancelEditName"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
            <div v-else class="flex items-center gap-2">
              <h2 class="text-base font-medium">{{ conversations.selected.displayName }}</h2>
              <button
                v-if="conversations.selected.isGroup"
                type="button"
                class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Rename group"
                @click="startEditName"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
            </div>
            <p v-if="nameError" class="mt-1 text-xs text-destructive-foreground">{{ nameError }}</p>
            <p
              v-else-if="conversations.selected.isGroup && !editingName"
              class="text-xs text-muted-foreground"
            >
              {{ conversations.selected.participants.length }} members
            </p>
          </header>
          <MessageThread :key="conversations.selected.id" :conversation="conversations.selected" />
        </div>
      </main>
    </div>

    <NewChatModal
      v-if="showNewChat"
      @close="showNewChat = false"
      @created="onCreated"
    />

    <DisplayNamePrompt v-if="auth.needsDisplayName" />
  </div>
</template>
