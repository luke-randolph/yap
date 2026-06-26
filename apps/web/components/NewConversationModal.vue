<script setup lang="ts">
import { X } from 'lucide-vue-next';
import {
  CONVERSATION_ERROR_CODES,
  VALIDATION_LIMITS,
  emailSchema,
  getApiError,
  type ConversationDTO,
  type UserPublicDTO,
} from '@yap/contracts';

const emit = defineEmits<{
  close: [];
  created: [conversation: ConversationDTO];
}>();

interface Recipient {
  id: string | null; // null when added by raw email (not a resolved search hit)
  email: string;
  displayName: string;
}

const conversations = useConversationsStore();
const auth = useAuthStore();

const recipients = ref<Recipient[]>([]);
const query = ref('');
const results = ref<UserPublicDTO[]>([]);
const searching = ref(false);
const name = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

const maxOthers = VALIDATION_LIMITS.maxGroupParticipants - 1;
const showNameField = computed(() => recipients.value.length >= 2);
const canSubmit = computed(() => recipients.value.length > 0 && !submitting.value);

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
    const chosen = new Set(recipients.value.map((r) => r.email));
    results.value = found.filter((u) => u.email !== auth.user?.email && !chosen.has(u.email));
  } catch {
    results.value = [];
  } finally {
    searching.value = false;
  }
}

function atCapacity(): boolean {
  if (recipients.value.length >= maxOthers) {
    error.value = `At most ${maxOthers} other participants`;
    return true;
  }
  return false;
}

function addRecipient(r: Recipient) {
  if (recipients.value.some((x) => x.email === r.email)) return;
  if (atCapacity()) return;
  recipients.value.push(r);
  query.value = '';
  results.value = [];
  error.value = null;
}

function addFromSearch(u: UserPublicDTO) {
  addRecipient({ id: u.id, email: u.email, displayName: u.displayName });
}

// Fallback: let the user commit a raw email even if search returned nothing
// (the API still validates it resolves to a real account on submit).
function commitEmail(): boolean {
  const raw = query.value.trim().replace(/,$/, '').trim();
  if (!raw) return false;
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    error.value = `Invalid email: ${raw}`;
    return false;
  }
  const email = parsed.data;
  if (email === auth.user?.email) {
    error.value = "You can't add yourself";
    return false;
  }
  if (recipients.value.some((r) => r.email === email)) {
    query.value = '';
    return false;
  }
  if (atCapacity()) return false;
  recipients.value.push({ id: null, email, displayName: email });
  query.value = '';
  results.value = [];
  error.value = null;
  return true;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const top = results.value[0];
    if (top) addFromSearch(top);
    else commitEmail();
    return;
  }
  if (e.key === 'Backspace' && query.value === '' && recipients.value.length > 0) {
    recipients.value.pop();
  }
}

function removeChip(email: string) {
  recipients.value = recipients.value.filter((r) => r.email !== email);
}

async function submit() {
  if (query.value.trim() && results.value.length === 0) commitEmail();
  if (recipients.value.length === 0) {
    error.value = 'Add at least one recipient';
    return;
  }
  error.value = null;
  submitting.value = true;
  try {
    const trimmedName = name.value.trim();
    const conv = await conversations.create({
      participantEmails: recipients.value.map((r) => r.email),
      ...(showNameField.value && trimmedName ? { name: trimmedName } : {}),
    });
    emit('created', conv);
  } catch (e) {
    error.value = extractMessage(e) ?? 'Could not create chat';
  } finally {
    submitting.value = false;
  }
}

function extractMessage(e: unknown): string | null {
  const err = getApiError(e);
  if (!err) return null;
  if (err.code === CONVERSATION_ERROR_CODES.unknownEmails) {
    const unknownEmails = (err.details as { unknownEmails?: string[] } | undefined)?.unknownEmails;
    if (unknownEmails) return `Not on Yap yet: ${unknownEmails.join(', ')}`;
  }
  return err.message ?? null;
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex items-start justify-between">
        <div>
          <h2 class="text-lg font-semibold tracking-tight">New chat</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Search by name or email — one for a DM, more for a group.
          </p>
        </div>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <div>
          <label class="text-sm font-medium">Recipients</label>
          <div class="relative">
            <div
              class="mt-1 flex flex-wrap gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-primary"
            >
              <span
                v-for="r in recipients"
                :key="r.email"
                class="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
                :title="r.email"
              >
                {{ r.displayName }}
                <button type="button" class="hover:opacity-70" @click="removeChip(r.email)">
                  <X class="h-3 w-3" />
                </button>
              </span>
              <input
                v-model="query"
                type="text"
                autocomplete="off"
                :placeholder="recipients.length === 0 ? 'Name or email' : ''"
                class="min-w-[8rem] flex-1 bg-transparent text-sm outline-none"
                @keydown="onKeydown"
              />
            </div>

            <ul
              v-if="query.trim() && (results.length > 0 || !searching)"
              class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg"
            >
              <li v-for="u in results" :key="u.id">
                <button
                  type="button"
                  class="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                  @click="addFromSearch(u)"
                >
                  <span class="text-sm font-medium">{{ u.displayName }}</span>
                  <span class="text-xs text-muted-foreground">{{ u.email }}</span>
                </button>
              </li>
              <li
                v-if="results.length === 0 && !searching"
                class="px-3 py-2 text-xs text-muted-foreground"
              >
                No matches. Press Enter to add an exact email.
              </li>
            </ul>
          </div>
        </div>

        <div v-if="showNameField">
          <label class="text-sm font-medium">Group name (optional)</label>
          <input
            v-model="name"
            type="text"
            :maxlength="VALIDATION_LIMITS.maxConversationNameLength"
            placeholder="Defaults to participant names"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <p
          v-if="error"
          class="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-foreground"
        >
          {{ error }}
        </p>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="emit('close')"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="!canSubmit"
            class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {{ submitting ? 'Creating…' : 'Start chat' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
