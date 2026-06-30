<script setup lang="ts">
import { AUTH_ERROR_CODES, getApiError } from '@yap/contracts';

const auth = useAuthStore();

const step = ref<'email' | 'code' | 'name' | 'request' | 'requested'>('email');
const email = ref('');
const code = ref('');
const displayName = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);
const demoing = ref(false);

const heading = computed(() => {
  if (step.value === 'name') return 'One last step';
  if (step.value === 'request') return 'Request access';
  if (step.value === 'requested') return 'Request sent';
  return 'Sign in';
});

const subtitle = computed(() => {
  if (step.value === 'email') return "We'll email you a 6-digit code.";
  if (step.value === 'code') return `Code sent to ${email.value}.`;
  if (step.value === 'request')
    return "Full access to Yap is currently request-only. Enter your email and we'll review your request!";
  if (step.value === 'requested')
    return `Thanks! We'll email ${email.value} once you're approved. Want a look around now? Try the demo.`;
  return 'Pick a display name to finish creating your account.';
});

async function submitEmail() {
  error.value = null;
  submitting.value = true;
  try {
    await auth.requestOtp(email.value);
    step.value = 'code';
  } catch (e) {
    if (getApiError(e)?.code === AUTH_ERROR_CODES.emailNotAllowlisted) {
      step.value = 'request';
      return;
    }
    error.value = extractMessage(e) ?? 'Failed to send code';
  } finally {
    submitting.value = false;
  }
}

function goToRequest() {
  error.value = null;
  step.value = 'request';
}

async function submitRequest() {
  error.value = null;
  submitting.value = true;
  try {
    await auth.requestAccess(email.value);
    step.value = 'requested';
  } catch (e) {
    error.value = extractMessage(e) ?? 'Could not send your request';
  } finally {
    submitting.value = false;
  }
}

async function tryDemo() {
  error.value = null;
  demoing.value = true;
  try {
    await auth.demoLogin();
    await navigateTo('/');
  } catch (e) {
    error.value = extractMessage(e) ?? 'Could not start the demo';
  } finally {
    demoing.value = false;
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
      <img src="/yap-logo.png" alt="Yap" class="mb-5 h-9 w-auto mx-auto" />
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

        <p class="text-center text-sm text-muted-foreground">
          Not signed up yet?
          <button
            type="button"
            class="font-medium text-primary hover:underline"
            @click="goToRequest"
          >
            Request access
          </button>
        </p>

        <div class="flex items-center gap-3 pt-1">
          <span class="h-px flex-1 bg-border" />
          <span class="text-xs text-muted-foreground">or</span>
          <span class="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          :disabled="demoing"
          class="w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          @click="tryDemo"
        >
          {{ demoing ? 'Starting demo…' : 'Try the demo' }}
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

      <form v-else-if="step === 'name'" class="mt-6 space-y-4" @submit.prevent="submitName">
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

      <form v-else-if="step === 'request'" class="mt-6 space-y-4" @submit.prevent="submitRequest">
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
          {{ submitting ? 'Sending…' : 'Request access' }}
        </button>
        <button
          type="button"
          class="w-full text-sm text-muted-foreground hover:text-foreground"
          @click="reset"
        >
          Back
        </button>
      </form>

      <div v-else-if="step === 'requested'" class="mt-6 space-y-4">
        <button
          type="button"
          :disabled="demoing"
          class="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          @click="tryDemo"
        >
          {{ demoing ? 'Starting demo…' : 'Try the demo' }}
        </button>
        <button
          type="button"
          class="w-full text-sm text-muted-foreground hover:text-foreground"
          @click="reset"
        >
          Back to sign in
        </button>
      </div>

      <p
        v-if="error"
        class="mt-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-foreground"
      >
        {{ error }}
      </p>
    </div>
  </div>
</template>
