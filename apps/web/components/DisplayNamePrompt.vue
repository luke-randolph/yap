<script setup lang="ts">
import { getApiError } from '@yap/contracts';

const auth = useAuthStore();

const name = ref(auth.user?.displayName?.trim() ?? '');
const error = ref<string | null>(null);
const submitting = ref(false);

const canSubmit = computed(() => name.value.trim().length > 0 && !submitting.value);

async function submit() {
  const trimmed = name.value.trim();
  if (!trimmed) {
    error.value = 'Please enter a name';
    return;
  }
  error.value = null;
  submitting.value = true;
  try {
    await auth.updateProfile(trimmed);
  } catch (e) {
    error.value = extractMessage(e) ?? 'Could not save your name';
  } finally {
    submitting.value = false;
  }
}

function extractMessage(e: unknown): string | null {
  return getApiError(e)?.message ?? null;
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2640]/55 backdrop-blur-sm">
    <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
      <h2 class="text-lg font-semibold tracking-tight">What should we call you?</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Pick a display name so others can recognize you. You can change it later.
      </p>

      <form class="mt-5 space-y-4" @submit.prevent="submit">
        <input
          v-model="name"
          type="text"
          autofocus
          :maxlength="50"
          placeholder="e.g. Luke"
          class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <p
          v-if="error"
          class="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-foreground"
        >
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="!canSubmit"
          class="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ submitting ? 'Saving…' : 'Continue' }}
        </button>
      </form>
    </div>
  </div>
</template>
