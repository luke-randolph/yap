<script setup lang="ts">
import { Check, X, Trash2 } from 'lucide-vue-next';
import { getApiError, type AccessRequestDTO, type AccessStatus } from '@yap/contracts';

const emit = defineEmits<{
  close: [];
}>();

const api = useApi();
const toasts = useToastsStore();

type Tab = AccessStatus;
const TABS: { key: Tab; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'denied', label: 'Denied' },
];

const tab = ref<Tab>('pending');
const rows = ref<AccessRequestDTO[]>([]);
const loading = ref(false);
const busy = ref<Set<string>>(new Set());

const newEmail = ref('');
const newNote = ref('');
const adding = ref(false);

async function load() {
  loading.value = true;
  try {
    rows.value = await api<AccessRequestDTO[]>('/admin/access-requests', {
      query: { status: tab.value },
    });
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not load requests');
  } finally {
    loading.value = false;
  }
}

watch(tab, load);
onMounted(load);

async function act(row: AccessRequestDTO, run: () => Promise<unknown>, okMsg: string) {
  if (busy.value.has(row.id)) return;
  busy.value.add(row.id);
  try {
    await run();
    rows.value = rows.value.filter((r) => r.id !== row.id);
    toasts.success(okMsg);
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Action failed');
  } finally {
    busy.value.delete(row.id);
  }
}

const approve = (row: AccessRequestDTO) =>
  act(row, () => api(`/admin/access-requests/${row.id}/approve`, { method: 'POST' }), `Approved ${row.email}`);
const deny = (row: AccessRequestDTO) =>
  act(row, () => api(`/admin/access-requests/${row.id}/deny`, { method: 'POST' }), `Denied ${row.email}`);
const remove = (row: AccessRequestDTO) =>
  act(row, () => api(`/admin/access-requests/${row.id}`, { method: 'DELETE' }), `Removed ${row.email}`);

async function addEmail() {
  const email = newEmail.value.trim();
  if (!email || adding.value) return;
  adding.value = true;
  try {
    await api('/admin/access-requests', {
      method: 'POST',
      body: { email, ...(newNote.value.trim() ? { note: newNote.value.trim() } : {}) },
    });
    toasts.success(`Allowlisted ${email}`);
    newEmail.value = '';
    newNote.value = '';
    if (tab.value === 'approved') await load();
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not add email');
  } finally {
    adding.value = false;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex items-start justify-between">
        <h2 class="text-lg font-semibold tracking-tight">Access requests</h2>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <form class="mt-4 flex flex-wrap gap-2" @submit.prevent="addEmail">
        <input
          v-model="newEmail"
          type="email"
          placeholder="invite@example.com"
          class="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          v-model="newNote"
          type="text"
          maxlength="200"
          placeholder="note (optional)"
          class="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button
          type="submit"
          :disabled="adding || !newEmail.trim()"
          class="shrink-0 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ adding ? 'Adding…' : 'Allowlist' }}
        </button>
      </form>

      <div class="mt-4 flex gap-1 border-b border-border">
        <button
          v-for="t in TABS"
          :key="t.key"
          type="button"
          class="-mb-px border-b-2 px-3 py-2 text-sm font-medium"
          :class="
            tab === t.key
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <div class="mt-3 min-h-0 flex-1 overflow-y-auto">
        <p v-if="loading" class="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        <p v-else-if="!rows.length" class="py-6 text-center text-sm text-muted-foreground">
          No {{ tab }} requests.
        </p>
        <ul v-else class="space-y-2">
          <li
            v-for="row in rows"
            :key="row.id"
            class="flex items-center gap-2 rounded-md border border-border px-3 py-2"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ row.displayName || row.email }}</p>
              <p class="truncate text-xs text-muted-foreground">
                {{ row.displayName ? row.email + ' · ' : '' }}{{ formatDate(row.createdAt) }}
                <span v-if="row.note"> · {{ row.note }}</span>
              </p>
            </div>
            <template v-if="tab === 'pending'">
              <button
                type="button"
                :disabled="busy.has(row.id)"
                class="shrink-0 rounded-md bg-primary p-1.5 text-primary-foreground hover:opacity-90 disabled:opacity-50"
                title="Approve"
                @click="approve(row)"
              >
                <Check class="h-4 w-4" />
              </button>
              <button
                type="button"
                :disabled="busy.has(row.id)"
                class="shrink-0 rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-50"
                title="Deny"
                @click="deny(row)"
              >
                <X class="h-4 w-4" />
              </button>
            </template>
            <button
              v-else
              type="button"
              :disabled="busy.has(row.id)"
              class="shrink-0 rounded-md border border-border p-1.5 text-destructive-foreground hover:bg-muted disabled:opacity-50"
              title="Remove"
              @click="remove(row)"
            >
              <Trash2 class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
