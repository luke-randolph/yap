<script setup lang="ts">
import { UserPlus, X } from 'lucide-vue-next';
import { emailSchema, getApiError } from '@yap/contracts';

const emit = defineEmits<{ close: [] }>();

const friends = useFriendsStore();
const toasts = useToastsStore();

const email = ref('');
const adding = ref(false);
const addError = ref<string | null>(null);

async function add() {
  const parsed = emailSchema.safeParse(email.value.trim());
  if (!parsed.success) {
    addError.value = 'Enter a valid email';
    return;
  }
  adding.value = true;
  addError.value = null;
  try {
    const req = await friends.sendRequest(parsed.data);
    if (req.direction === 'incoming') {
      toasts.success(`You and ${req.user.displayName} are now friends`);
    } else {
      toasts.success(`Friend request sent to ${req.user.displayName}`);
    }
    emit('close');
  } catch (e) {
    addError.value = getApiError(e)?.message ?? 'Could not send request';
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex items-start justify-between">
        <h2 class="text-lg font-semibold tracking-tight">Add a friend</h2>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <label class="mt-5 block text-sm font-medium">Their email</label>
      <input
        v-model="email"
        type="email"
        autocomplete="off"
        autofocus
        placeholder="name@example.com"
        class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        @keydown.enter.prevent="add"
      />
      <p v-if="addError" class="mt-1 text-sm text-destructive-foreground">{{ addError }}</p>

      <button
        type="button"
        :disabled="adding || !email.trim()"
        class="mt-4 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        @click="add"
      >
        <UserPlus class="h-4 w-4" />
        Send request
      </button>
    </div>
  </div>
</template>
