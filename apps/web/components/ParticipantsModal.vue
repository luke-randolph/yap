<script setup lang="ts">
import { Ban, LogOut, Plus, X } from 'lucide-vue-next';
import {
  CONVERSATION_ERROR_CODES,
  getApiError,
  type ConversationDTO,
  type ParticipantDTO,
  type UserPublicDTO,
} from '@yap/contracts';

const props = defineProps<{
  conversation: ConversationDTO;
}>();

const emit = defineEmits<{ close: [] }>();

const conversations = useConversationsStore();
const auth = useAuthStore();
const toasts = useToastsStore();

const active = ref<ParticipantDTO[]>([]);
const former = ref<ParticipantDTO[]>([]);
const loading = ref(true);

const query = ref('');
const results = ref<UserPublicDTO[]>([]);
const searching = ref(false);
const pending = ref<Set<string>>(new Set());

const confirming = ref<'leave' | 'block' | null>(null);
const actionLoading = ref(false);
const selectedUser = ref<UserPublicDTO | null>(null);

const activeEmails = computed(() => new Set(active.value.map((p) => p.user.email)));

async function load() {
  loading.value = true;
  try {
    const data = await conversations.fetchParticipants(props.conversation.id);
    active.value = data.active;
    former.value = data.former;
  } catch {
    toasts.error('Could not load members');
  } finally {
    loading.value = false;
  }
}

onMounted(load);

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(query, (q) => {
  if (searchTimer) clearTimeout(searchTimer);
  const trimmed = q.trim();
  if (!trimmed) {
    results.value = [];
    return;
  }
  searchTimer = setTimeout(() => runSearch(trimmed), 200);
});

async function runSearch(q: string) {
  searching.value = true;
  try {
    const api = useApi();
    const found = await api<UserPublicDTO[]>('/users/search', { query: { q } });
    results.value = found.filter((u) => !activeEmails.value.has(u.email));
  } catch {
    results.value = [];
  } finally {
    searching.value = false;
  }
}

async function add(user: { email: string; displayName: string }) {
  if (pending.value.has(user.email)) return;
  pending.value.add(user.email);
  try {
    await conversations.addParticipants(props.conversation.id, [user.email]);
    toasts.success(`Added ${user.displayName}`);
    query.value = '';
    results.value = [];
    await load();
  } catch (e) {
    toasts.error(reAddError(e) ?? `Could not add ${user.displayName}`);
  } finally {
    pending.value.delete(user.email);
  }
}

function reAddError(e: unknown): string | null {
  const err = getApiError(e);
  if (!err) return null;
  if (err.code === CONVERSATION_ERROR_CODES.participantsBlocked) {
    return 'They blocked this group and can’t be re-added.';
  }
  return err.message ?? null;
}

async function confirmAction() {
  if (!confirming.value) return;
  actionLoading.value = true;
  try {
    if (confirming.value === 'leave') {
      await conversations.leave(props.conversation.id);
      toasts.success('You left the group');
    } else {
      await conversations.block(props.conversation.id);
      toasts.success('Group blocked');
    }
    emit('close');
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Something went wrong');
    actionLoading.value = false;
    confirming.value = null;
  }
}

function isSelf(p: ParticipantDTO): boolean {
  return p.user.id === auth.user?.id;
}

function openProfile(user: UserPublicDTO) {
  if (user.id !== auth.user?.id) selectedUser.value = user;
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div
      class="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border bg-card shadow-lg"
    >
      <div class="flex items-start justify-between p-6 pb-3">
        <div>
          <h2 class="text-lg font-semibold tracking-tight">Members</h2>
          <p class="mt-1 text-sm text-muted-foreground">{{ active.length }} in this group</p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="px-6">
        <label class="text-sm font-medium">Add people</label>
        <div class="relative mt-1">
          <input
            v-model="query"
            type="text"
            autocomplete="off"
            placeholder="Search by name or email"
            class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <ul
            v-if="query.trim() && (results.length > 0 || !searching)"
            class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg"
          >
            <li v-for="u in results" :key="u.id">
              <button
                type="button"
                :disabled="pending.has(u.email)"
                class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted disabled:opacity-50"
                @click="add(u)"
              >
                <span class="flex items-center gap-2">
                  <UserAvatar :name="u.displayName" :src="u.avatarUrl" :size="28" />
                  <span class="flex flex-col">
                    <span class="text-sm font-medium">{{ u.displayName }}</span>
                    <span class="text-xs text-muted-foreground">{{ u.email }}</span>
                  </span>
                </span>
                <Plus class="h-4 w-4 shrink-0 text-primary" />
              </button>
            </li>
            <li
              v-if="results.length === 0 && !searching"
              class="px-3 py-2 text-xs text-muted-foreground"
            >
              No matches.
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-4 min-h-0 flex-1 overflow-y-auto px-6">
        <ul v-if="!loading" class="space-y-1">
          <li
            v-for="p in active"
            :key="p.user.id"
            class="flex items-center gap-2 rounded-md px-1 py-1.5"
          >
            <button
              v-if="!isSelf(p)"
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
              @click="openProfile(p.user)"
            >
              <UserAvatar :name="p.user.displayName" :src="p.user.avatarUrl" :size="32" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ p.user.displayName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ p.user.email }}</span>
              </span>
            </button>
            <div v-else class="flex min-w-0 flex-1 items-center gap-2">
              <UserAvatar :name="p.user.displayName" :src="p.user.avatarUrl" :size="32" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium">{{ p.user.displayName }}</span>
                <span class="block truncate text-xs text-muted-foreground">{{ p.user.email }}</span>
              </span>
            </div>
            <span v-if="isSelf(p)" class="text-xs text-muted-foreground">You</span>
            <span
              v-else-if="p.user.id === conversation.createdById"
              class="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
            >
              Creator
            </span>
          </li>
        </ul>
        <p v-else class="py-4 text-center text-sm text-muted-foreground">Loading…</p>

        <template v-if="former.length">
          <p class="mt-4 mb-1 text-xs font-medium text-muted-foreground">
            Previously in this group
          </p>
          <ul class="space-y-1 pb-2">
            <li
              v-for="p in former"
              :key="p.user.id"
              class="flex items-center gap-2 rounded-md px-1 py-1.5"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-80"
                @click="openProfile(p.user)"
              >
                <UserAvatar :name="p.user.displayName" :src="p.user.avatarUrl" :size="32" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ p.user.displayName }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{
                    p.user.email
                  }}</span>
                </span>
              </button>
              <button
                type="button"
                :disabled="pending.has(p.user.email)"
                class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                @click="add(p.user)"
              >
                <Plus class="h-3.5 w-3.5" />
                Re-add
              </button>
            </li>
          </ul>
        </template>
      </div>

      <div class="flex gap-2 border-t border-border p-4">
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          @click="confirming = 'leave'"
        >
          <LogOut class="h-4 w-4" />
          Leave group
        </button>
        <button
          type="button"
          class="flex flex-1 items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive-soft"
          @click="confirming = 'block'"
        >
          <Ban class="h-4 w-4" />
          Block group
        </button>
      </div>
    </div>

    <ConfirmModal
      v-if="confirming === 'leave'"
      title="Leave group?"
      message="You’ll stop receiving messages. Another member can add you back later."
      confirm-label="Leave"
      danger
      :loading="actionLoading"
      @confirm="confirmAction"
      @cancel="confirming = null"
    />
    <ConfirmModal
      v-if="confirming === 'block'"
      title="Block group?"
      message="You’ll leave and no one will be able to add you back until you unblock it from your profile."
      confirm-label="Block"
      danger
      :loading="actionLoading"
      @confirm="confirmAction"
      @cancel="confirming = null"
    />

    <UserProfileModal v-if="selectedUser" :user="selectedUser" @close="selectedUser = null" />
  </div>
</template>
