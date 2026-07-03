<script setup lang="ts">
import { ChevronDown, LogOut, X } from 'lucide-vue-next';
import { AVATAR, getApiError, type ConversationDTO } from '@yap/contracts';

const emit = defineEmits<{
  close: [];
  logout: [];
  'exit-demo': [];
}>();

const auth = useAuthStore();
const toasts = useToastsStore();
const conversations = useConversationsStore();

const blocked = ref<ConversationDTO[]>([]);
const unblocking = ref<Set<string>>(new Set());
const blockedOpen = ref(false);

async function loadBlocked() {
  try {
    blocked.value = await conversations.fetchBlocked();
  } catch {
    // Non-critical; the section just stays empty.
  }
}

async function unblock(conversation: ConversationDTO) {
  if (unblocking.value.has(conversation.id)) return;
  unblocking.value.add(conversation.id);
  try {
    await conversations.unblock(conversation.id);
    blocked.value = blocked.value.filter((c) => c.id !== conversation.id);
    toasts.success(`Unblocked ${conversation.displayName}`);
  } catch (e) {
    toasts.error(getApiError(e)?.message ?? 'Could not unblock');
  } finally {
    unblocking.value.delete(conversation.id);
  }
}

onMounted(loadBlocked);

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const photoError = ref<string | null>(null);
const saving = ref(false);
const removing = ref(false);

const nameDraft = ref(auth.user?.displayName ?? '');
const savingName = ref(false);
const nameError = ref<string | null>(null);

const hasAvatar = computed(() => !!auth.user?.avatarUrl);
const displaySrc = computed(() => previewUrl.value ?? auth.user?.avatarUrl ?? null);

const canSaveName = computed(() => {
  const trimmed = nameDraft.value.trim();
  return trimmed.length > 0 && trimmed !== auth.user?.displayName && !savingName.value;
});

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  selectedFile.value = null;
}

function pickFile() {
  photoError.value = null;
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!AVATAR.allowedMimeTypes.some((t) => t === file.type)) {
    photoError.value = 'Please choose a JPEG, PNG, WebP, or GIF image.';
    return;
  }
  if (file.size > AVATAR.maxUploadBytes) {
    photoError.value = `Image must be under ${Math.round(AVATAR.maxUploadBytes / 1024 / 1024)} MB.`;
    return;
  }
  clearPreview();
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
  photoError.value = null;
}

async function savePhoto() {
  if (!selectedFile.value) return;
  saving.value = true;
  photoError.value = null;
  try {
    await auth.uploadAvatar(selectedFile.value);
    clearPreview();
    toasts.success('Photo updated');
  } catch (e) {
    photoError.value = getApiError(e)?.message ?? 'Could not upload photo';
  } finally {
    saving.value = false;
  }
}

async function removePhoto() {
  removing.value = true;
  photoError.value = null;
  try {
    await auth.removeAvatar();
    clearPreview();
    toasts.success('Photo removed');
  } catch (e) {
    photoError.value = getApiError(e)?.message ?? 'Could not remove photo';
  } finally {
    removing.value = false;
  }
}

async function saveName() {
  const trimmed = nameDraft.value.trim();
  if (!trimmed) {
    nameError.value = 'Name cannot be empty';
    return;
  }
  savingName.value = true;
  nameError.value = null;
  try {
    await auth.updateProfile(trimmed);
    toasts.success('Name updated');
  } catch (e) {
    nameError.value = getApiError(e)?.message ?? 'Could not save your name';
  } finally {
    savingName.value = false;
  }
}

onBeforeUnmount(clearPreview);
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex items-start justify-between">
        <h2 class="text-lg font-semibold tracking-tight">Profile</h2>
        <button
          type="button"
          class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <div class="mt-5 flex flex-col items-center gap-4">
        <UserAvatar :name="auth.user?.displayName ?? ''" :src="displaySrc" :size="112" />

        <input
          ref="fileInput"
          type="file"
          class="hidden"
          :accept="AVATAR.allowedMimeTypes.join(',')"
          @change="onFileChange"
        />

        <div class="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            class="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="pickFile"
          >
            {{ hasAvatar || selectedFile ? 'Choose another' : 'Choose photo' }}
          </button>
          <button
            v-if="hasAvatar && !selectedFile"
            type="button"
            :disabled="removing"
            class="rounded-md border border-border px-3 py-1.5 text-sm text-destructive-foreground hover:bg-muted disabled:opacity-50"
            @click="removePhoto"
          >
            {{ removing ? 'Removing…' : 'Remove' }}
          </button>
        </div>

        <div v-if="selectedFile" class="flex gap-2">
          <button
            type="button"
            class="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            @click="clearPreview"
          >
            Cancel
          </button>
          <button
            type="button"
            :disabled="saving"
            class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="savePhoto"
          >
            {{ saving ? 'Saving…' : 'Save photo' }}
          </button>
        </div>

        <p v-if="photoError" class="text-sm text-destructive-foreground">{{ photoError }}</p>
      </div>

      <div class="mt-6">
        <label class="text-sm font-medium">Display name</label>
        <div class="mt-1 flex items-center gap-2">
          <input
            v-model="nameDraft"
            type="text"
            :maxlength="50"
            class="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            @keydown.enter.prevent="canSaveName && saveName()"
          />
          <button
            type="button"
            :disabled="!canSaveName"
            class="shrink-0 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            @click="saveName"
          >
            {{ savingName ? 'Saving…' : 'Save' }}
          </button>
        </div>
        <p v-if="nameError" class="mt-1 text-sm text-destructive-foreground">{{ nameError }}</p>
      </div>

      <div v-if="blocked.length" class="mt-6">
        <button
          type="button"
          class="flex w-full items-center justify-between text-sm font-medium"
          :aria-expanded="blockedOpen"
          @click="blockedOpen = !blockedOpen"
        >
          <span>Blocked groups ({{ blocked.length }})</span>
          <ChevronDown
            class="h-4 w-4 text-muted-foreground transition-transform"
            :class="blockedOpen ? 'rotate-180' : ''"
          />
        </button>
        <ul v-if="blockedOpen" class="mt-2 space-y-1">
          <li
            v-for="conversation in blocked"
            :key="conversation.id"
            class="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
          >
            <span class="min-w-0 flex-1 truncate text-sm">{{ conversation.displayName }}</span>
            <button
              type="button"
              :disabled="unblocking.has(conversation.id)"
              class="shrink-0 rounded-md px-2 py-1 text-xs text-primary hover:bg-muted disabled:opacity-50"
              @click="unblock(conversation)"
            >
              Unblock
            </button>
          </li>
        </ul>
      </div>

      <button
        type="button"
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="auth.user?.isGuest ? emit('exit-demo') : emit('logout')"
      >
        <LogOut class="h-4 w-4" />
        {{ auth.user?.isGuest ? 'Exit demo' : 'Log out' }}
      </button>
    </div>
  </div>
</template>
