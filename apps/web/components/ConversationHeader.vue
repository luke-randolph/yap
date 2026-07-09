<script setup lang="ts">
import { Check, Menu, Pencil, Pin, Users, X } from 'lucide-vue-next';
import { getApiError, type ConversationDTO, type UserPublicDTO } from '@yap/contracts';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const auth = useAuthStore();
const conversations = useConversationsStore();
const sidebar = useSidebarStore();
const toasts = useToastsStore();

const MAX_DISCS = 3;

const discPeople = computed(() => props.conversation.participants.map((p) => p.user));

const shownDiscs = computed(() => discPeople.value.slice(0, MAX_DISCS));
const extraDiscs = computed(() => Math.max(0, discPeople.value.length - MAX_DISCS));

const otherUser = computed(() => discPeople.value.find((u) => u.id !== auth.user?.id) ?? null);
const selectedUser = ref<UserPublicDTO | null>(null);

function openProfile(user: UserPublicDTO) {
  if (user.id !== auth.user?.id) selectedUser.value = user;
}

const showParticipants = ref(false);
const showPinned = ref(false);
const editingName = ref(false);
const nameDraft = ref('');
const savingName = ref(false);
const nameError = ref<string | null>(null);

function startEditName() {
  nameDraft.value = props.conversation.name ?? props.conversation.displayName;
  nameError.value = null;
  editingName.value = true;
}

function cancelEditName() {
  editingName.value = false;
  nameError.value = null;
}

async function saveName() {
  const trimmed = nameDraft.value.trim();
  if (!trimmed) {
    nameError.value = 'Name cannot be empty';
    return;
  }
  if (trimmed === props.conversation.name) {
    editingName.value = false;
    return;
  }
  savingName.value = true;
  nameError.value = null;
  try {
    await conversations.update(props.conversation.id, { name: trimmed });
    editingName.value = false;
    toasts.success('Chat renamed');
  } catch (e) {
    nameError.value = getApiError(e)?.message ?? 'Could not rename chat';
  } finally {
    savingName.value = false;
  }
}
</script>

<template>
  <header class="border-b border-border bg-card px-6 py-3 flex flex-col gap-1">
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
        class="rounded-md p-1.5 text-success hover:bg-muted disabled:opacity-50"
        title="Save"
        :disabled="savingName"
        @click="saveName"
      >
        <Check class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded-md p-1.5 text-destructive hover:bg-muted"
        title="Cancel"
        @click="cancelEditName"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
    <div v-else class="flex items-center gap-4">
      <button
        type="button"
        class="-ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        title="Show chats"
        aria-label="Show chats"
        aria-controls="conversation-sidebar"
        :aria-expanded="sidebar.isOpen"
        @click="sidebar.toggle"
      >
        <Menu class="h-5 w-5" />
      </button>
      <div class="flex items-center -space-x-2">
        <button
          v-for="u in shownDiscs"
          :key="u.id"
          type="button"
          class="flex rounded-full ring-1 ring-border transition-colors"
          :class="u.id === auth.user?.id ? 'cursor-default' : 'hover:ring-primary'"
          :title="u.displayName"
          @click="openProfile(u)"
        >
          <UserAvatar :name="u.displayName" :src="u.avatarUrl" :size="28" />
        </button>
        <span
          v-if="extraDiscs"
          class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border"
        >
          +{{ extraDiscs }}
        </span>
      </div>
      <button
        v-if="!conversation.isGroup && otherUser"
        type="button"
        class="text-lg font-medium hover:underline"
        @click="openProfile(otherUser)"
      >
        {{ conversation.displayName }}
      </button>
      <h2 v-else class="text-lg font-medium">{{ conversation.displayName }}</h2>
      <div>
        <button
          v-if="conversation.isGroup"
          type="button"
          class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Rename group"
          @click="startEditName"
        >
          <Pencil class="h-3.5 w-3.5" />
        </button>
        <button
          v-if="conversation.isGroup"
          type="button"
          class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Members"
          @click="showParticipants = true"
        >
          <Users class="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          class="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Pinned messages"
          @click="showPinned = true"
        >
          <Pin class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    <p v-if="nameError" class="mt-1 text-xs text-destructive-foreground">{{ nameError }}</p>
    <button
      v-else-if="conversation.isGroup && !editingName"
      type="button"
      class="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
      @click="showParticipants = true"
    >
      {{ conversation.participants.length }} members
    </button>

    <ParticipantsModal
      v-if="showParticipants"
      :conversation="conversation"
      @close="showParticipants = false"
    />
    <PinnedMessagesModal
      v-if="showPinned"
      :conversation="conversation"
      @close="showPinned = false"
    />
    <UserProfileModal v-if="selectedUser" :user="selectedUser" @close="selectedUser = null" />
  </header>
</template>
