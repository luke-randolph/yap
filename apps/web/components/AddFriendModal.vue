<script setup lang="ts">
import { UserPlus } from 'lucide-vue-next';
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
  <BaseOverlay title="Add a friend" @close="emit('close')">
    <label class="mt-5 block text-sm font-medium">Their email</label>
    <TextInput
      v-model="email"
      type="email"
      autocomplete="off"
      autofocus
      placeholder="name@example.com"
      class="mt-1 w-full"
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
  </BaseOverlay>
</template>
