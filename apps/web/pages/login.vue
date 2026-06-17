<script setup lang="ts">
import { getApiError } from '@yap/contracts';

const auth = useAuthStore();

const step = ref<'email' | 'code' | 'name'>('email');
const email = ref('');
const code = ref('');
const displayName = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

const heading = computed(() => (step.value === 'name' ? 'One last step' : 'Sign in to Yap'));

const subtitle = computed(() => {
  if (step.value === 'email') return "We'll email you a 6-digit code.";
  if (step.value === 'code') return `Code sent to ${email.value}.`;
  return 'Pick a display name to finish creating your account.';
});

async function submitEmail() {
  error.value = null;
  submitting.value = true;
  try {
    await auth.requestOtp(email.value);
    step.value = 'code';
  } catch (e) {
    error.value = extractMessage(e) ?? 'Failed to send code';
  } finally {
    submitting.value = false;
  }
}

async function submitCode() {
  error.value = null;
  submitting.value = true;
  try {
    const result = await auth.verifyOtp({ email: email.value, code: code.value });
    if (result === 'needs_display_name') {
      step.value = 'name';
      return;
    }
    await navigateTo('/');
  } catch (e) {
    error.value = extractMessage(e) ?? 'Invalid code';
  } finally {
    submitting.value = false;
  }
}

async function submitName() {
  error.value = null;
  submitting.value = true;
  try {
    await auth.verifyOtp({
      email: email.value,
      code: code.value,
      displayName: displayName.value,
    });
    await navigateTo('/');
  } catch (e) {
    error.value = extractMessage(e) ?? 'Failed to create account';
  } finally {
    submitting.value = false;
  }
}

function reset() {
  step.value = 'email';
  code.value = '';
  displayName.value = '';
  error.value = null;
}

function extractMessage(e: unknown): string | null {
  return getApiError(e)?.message ?? null;
}
</script>

<template>
  <div class="grid min-h-screen place-items-center px-6">
    <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 class="text-xl font-semibold tracking-tight">{{ heading }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ subtitle }}</p>

      <form v-if="step === 'email'" class="mt-6 space-y-4" @submit.prevent="submitEmail">
        <label class="block">
          <span class="text-sm font-medium">Email</span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="you@example.com"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ submitting ? 'Sending...' : 'Send code' }}
        </button>
      </form>

      <form v-else-if="step === 'code'" class="mt-6 space-y-4" @submit.prevent="submitCode">
        <label class="block">
          <span class="text-sm font-medium">6-digit code</span>
          <input
            v-model="code"
            inputmode="numeric"
            pattern="\d{6}"
            maxlength="6"
            required
            autocomplete="one-time-code"
            placeholder="123456"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 tracking-[0.4em] outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ submitting ? 'Verifying...' : 'Verify' }}
        </button>
        <button
          type="button"
          class="w-full text-sm text-muted-foreground hover:text-foreground"
          @click="reset"
        >
          Use a different email
        </button>
      </form>

      <form v-else class="mt-6 space-y-4" @submit.prevent="submitName">
        <label class="block">
          <span class="text-sm font-medium">Display name</span>
          <input
            v-model="displayName"
            type="text"
            required
            maxlength="50"
            placeholder="Luke"
            class="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {{ submitting ? 'Creating...' : 'Create account' }}
        </button>
        <button
          type="button"
          class="w-full text-sm text-muted-foreground hover:text-foreground"
          @click="reset"
        >
          Use a different email
        </button>
      </form>

      <p
        v-if="error"
        class="mt-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-foreground"
      >
        {{ error }}
      </p>
    </div>
  </div>
</template>
