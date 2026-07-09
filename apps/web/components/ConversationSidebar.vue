<script setup lang="ts">
import { ChevronDown, Plus, Star, X } from 'lucide-vue-next';
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

type ConversationFilter = 'all' | 'groups' | 'dms';
const filterOptions: { value: ConversationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'groups', label: 'Groups' },
  { value: 'dms', label: 'DMs' },
];
const filter = ref<ConversationFilter>('all');
const requestsOpen = ref(false);

const requests = computed(() => props.conversations.filter((c) => c.requestState === 'incoming'));
const accepted = computed(() => props.conversations.filter((c) => c.requestState !== 'incoming'));

const filtered = computed(() => {
  if (filter.value === 'groups') return accepted.value.filter((c) => c.isGroup);
  if (filter.value === 'dms') return accepted.value.filter((c) => !c.isGroup);
  return accepted.value;
});

function selectConversation(id: string) {
  emit('select', id);
  sidebar.close();
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && sidebar.isOpen) sidebar.close();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));

function lastActivity(conversation: ConversationDTO): string {
  const iso = conversation.lastActivityAt ?? conversation.createdAt;
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function subline(conversation: ConversationDTO): string {
  if (conversation.requestState === 'outgoing') return 'Request pending';
  if (!conversation.isGroup) return 'Direct message';
  return `${conversation.participants.length} members`;
}
</script>

<template>
  <aside
    id="conversation-sidebar"
    aria-label="Conversations"
    class="absolute inset-y-0 left-0 z-40 flex h-full w-full flex-col border-r border-border bg-card transition-transform duration-300 ease-in-out md:static md:z-auto md:w-80 md:translate-x-0"
    :class="sidebar.isOpen ? 'translate-x-0' : '-translate-x-full'"
  >
    <div v-if="requests.length" class="border-b border-primary">
      <button
        type="button"
        class="flex w-full items-center justify-between p-4 transition-colors hover:bg-muted"
        :aria-expanded="requestsOpen"
        @click="requestsOpen = !requestsOpen"
      >
        <span class="flex items-center gap-2">
          <h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Requests
          </h2>
          <span
            class="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
          >
            {{ requests.length }}
          </span>
        </span>
        <ChevronDown
          class="h-4 w-4 mr-1 text-muted-foreground transition-transform"
          :class="requestsOpen ? '' : '-rotate-90'"
        />
      </button>
      <ul v-show="requestsOpen" class="max-h-[40vh] divide-y divide-border overflow-y-auto">
        <li v-for="conversation in requests" :key="conversation.id">
          <button
            type="button"
            class="block w-full px-4 py-3 text-left transition-colors hover:bg-muted"
            :class="conversation.id === selectedId ? 'bg-accent text-accent-foreground' : ''"
            @click="selectConversation(conversation.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-medium">{{ conversation.displayName }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{
                lastActivity(conversation)
              }}</span>
            </div>
          </button>
        </li>
      </ul>
    </div>

    <div class="flex items-center justify-between border-b border-border px-4 py-3">
      <h2 class="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Chats</h2>
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="New chat"
          aria-label="New chat"
          @click="emit('newConversation')"
        >
          <Plus class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          title="Close chats"
          aria-label="Close chats"
          @click="sidebar.close"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="flex gap-1 border-b border-border px-3 py-2">
      <button
        v-for="opt in filterOptions"
        :key="opt.value"
        type="button"
        class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
        :class="
          filter === opt.value
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        "
        @click="filter = opt.value"
      >
        {{ opt.label }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <p
        v-if="loading && conversations.length === 0"
        class="px-4 py-6 text-sm text-muted-foreground"
      >
        Loading…
      </p>
      <template v-else>
        <p
          v-if="!requests.length && accepted.length === 0"
          class="px-4 py-6 text-sm text-muted-foreground"
        >
          No chats yet. Tap <span class="font-medium text-foreground">+</span> to start one.
        </p>
        <p
          v-else-if="accepted.length > 0 && filtered.length === 0"
          class="px-4 py-6 text-sm text-muted-foreground"
        >
          No {{ filter === 'groups' ? 'group chats' : 'direct messages' }} yet.
        </p>
        <ul v-if="filtered.length" class="divide-y divide-border">
          <li v-for="conversation in filtered" :key="conversation.id" class="group relative">
            <button
              type="button"
              class="block w-full py-3 pl-4 text-left transition-colors hover:bg-muted"
              :class="[
                conversation.id === selectedId ? 'bg-accent text-accent-foreground' : '',
                conversation.isStarred ? 'pr-10' : 'pr-10 sm:pr-4 sm:group-hover:pr-10',
              ]"
              @click="selectConversation(conversation.id)"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="flex min-w-0 items-center gap-2">
                  <span class="truncate text-sm font-medium">{{ conversation.displayName }}</span>
                  <span
                    v-if="conversation.hasUnreadMessages"
                    class="h-2 w-2 shrink-0 rounded-full bg-primary"
                    title="New message"
                  />
                </span>
                <span class="shrink-0 text-xs text-muted-foreground">{{
                  lastActivity(conversation)
                }}</span>
              </div>
              <p class="mt-0.5 truncate text-xs text-muted-foreground">
                {{ subline(conversation) }}
              </p>
            </button>
            <button
              type="button"
              :aria-label="conversation.isStarred ? 'Unstar conversation' : 'Star conversation'"
              :title="conversation.isStarred ? 'Unstar conversation' : 'Star conversation'"
              class="group/star absolute top-3 right-2 rounded p-1"
              :class="
                conversation.isStarred
                  ? 'opacity-100'
                  : 'opacity-100 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100'
              "
              @click="emit('toggleStar', conversation.id)"
            >
              <Star
                :size="16"
                :stroke-width="1.75"
                class="transition"
                :class="
                  conversation.isStarred
                    ? 'fill-star text-star-foreground group-hover/star:opacity-60'
                    : 'fill-transparent text-muted-foreground group-hover/star:fill-muted-foreground'
                "
              />
            </button>
          </li>
        </ul>
      </template>
    </div>
  </aside>
</template>
