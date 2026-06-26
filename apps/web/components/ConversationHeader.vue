<script setup lang="ts">
import { Check, Menu, Pencil, X } from 'lucide-vue-next';
import { getApiError, type ConversationDTO } from '@yap/contracts';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const conversations = useConversationsStore();
const sidebar = useSidebarStore();

const MAX_DISCS = 3;

const discPeople = computed(() => props.conversation.participants.map((p) => p.user));

const shownDiscs = computed(() => discPeople.value.slice(0, MAX_DISCS));
const extraDiscs = computed(() => Math.max(0, discPeople.value.length - MAX_DISCS));

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
        <span v-for="u in shownDiscs" :key="u.id" class="flex rounded-full ring-2 ring-card">
          <UserAvatar :name="u.displayName" :src="u.avatarUrl" :size="28" />
        </span>
        <span
          v-if="extraDiscs"
          class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-card"
        >
          +{{ extraDiscs }}
        </span>
      </div>
      <h2 class="text-lg font-medium">{{ conversation.displayName }}</h2>
      <button
        v-if="conversation.isGroup"
        type="button"
        class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Rename group"
        @click="startEditName"
      >
        <Pencil class="h-3.5 w-3.5" />
      </button>
    </div>
    <p v-if="nameError" class="mt-1 text-xs text-destructive-foreground">{{ nameError }}</p>
    <p v-else-if="conversation.isGroup && !editingName" class="text-xs text-muted-foreground">
      {{ conversation.participants.length }} members
    </p>
  </header>
</template>
