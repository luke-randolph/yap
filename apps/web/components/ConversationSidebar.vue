<script setup lang="ts">
import { Plus, Star, X } from 'lucide-vue-next';
import type { ConversationDTO } from '@yap/contracts';

const props = defineProps<{
  conversations: ConversationDTO[];
  selectedId: string | null;
  loading: boolean;
  currentUserId: string | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  newConversation: [];
  toggleStar: [id: string];
}>();

const sidebar = useSidebarStore();

function selectConversation(id: string) {
  emit('select', id);
  sidebar.close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && sidebar.isOpen) sidebar.close();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function lastActivity(conv: ConversationDTO): string {
  const iso = conv.lastActivityAt ?? conv.createdAt;
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function subline(conv: ConversationDTO): string {
  if (!conv.isGroup)
    return conv.participants.find((p) => p.user.id !== props.currentUserId)?.user.email ?? '';
  return `${conv.participants.length} members`;
}
</script>

<template>
  <aside
    id="conversation-sidebar"
    aria-label="Conversations"
    class="absolute inset-y-0 left-0 z-40 flex h-full w-full flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out md:static md:z-auto md:w-80 md:translate-x-0"
    :class="sidebar.isOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Chats</h2>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="New chat"
          aria-label="New chat"
          @click="emit('newConversation')"
        >
          <Plus class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          title="Close chats"
          aria-label="Close chats"
          @click="sidebar.close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <p
        v-if="loading && conversations.length === 0"
        class="px-4 py-6 text-sm text-muted-foreground"
      >
        Loading…
      </p>
      <p v-else-if="conversations.length === 0" class="px-4 py-6 text-sm text-muted-foreground">
        No chats yet. Tap <span class="font-medium text-foreground">+</span> to start one.
      </p>
      <ul v-else class="divide-y divide-border">
        <li v-for="conv in conversations" :key="conv.id" class="group relative">
          <button
            type="button"
            class="block w-full py-3 pl-4 text-left transition-colors hover:bg-muted"
            :class="[
              conv.id === selectedId ? 'bg-accent text-accent-foreground' : '',
              conv.isStarred ? 'pr-10' : 'pr-10 sm:pr-4 sm:group-hover:pr-10',
            ]"
            @click="selectConversation(conv.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="truncate text-sm font-medium">{{ conv.displayName }}</span>
                <span
                  v-if="conv.hasUnreadMessages"
                  class="h-2 w-2 shrink-0 rounded-full bg-primary"
                  title="New message"
                />
              </span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ lastActivity(conv) }}</span>
            </div>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">{{ subline(conv) }}</p>
          </button>
          <button
            type="button"
            :aria-label="conv.isStarred ? 'Unstar conversation' : 'Star conversation'"
            :title="conv.isStarred ? 'Unstar conversation' : 'Star conversation'"
            class="group/star absolute top-3 right-2 rounded p-1"
            :class="
              conv.isStarred
                ? 'opacity-100'
                : 'opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100'
            "
            @click="emit('toggleStar', conv.id)"
          >
            <Star
              :size="16"
              :stroke-width="1.75"
              class="transition"
              :class="
                conv.isStarred
                  ? 'fill-star text-star-foreground group-hover/star:opacity-60'
                  : 'fill-transparent text-muted-foreground group-hover/star:fill-muted-foreground'
              "
            />
          </button>
        </li>
      </ul>
    </div>
  </aside>
</template>
