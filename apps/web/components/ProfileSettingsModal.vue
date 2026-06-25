<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { AVATAR, getApiError } from '@yap/contracts';

const emit = defineEmits<{
  close: [];
}>();

const auth = useAuthStore();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const error = ref<string | null>(null);
const saving = ref(false);
const removing = ref(false);

const hasAvatar = computed(() => !!auth.user?.avatarUrl);
const displaySrc = computed(() => previewUrl.value ?? auth.user?.avatarUrl ?? null);

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  selectedFile.value = null;
}

function pickFile() {
  error.value = null;
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (!AVATAR.allowedMimeTypes.some((t) => t === file.type)) {
    error.value = 'Please choose a JPEG, PNG, WebP, or GIF image.';
    return;
  }
  if (file.size > AVATAR.maxUploadBytes) {
    error.value = `Image must be under ${Math.round(AVATAR.maxUploadBytes / 1024 / 1024)} MB.`;
    return;
  }
  clearPreview();
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
  error.value = null;
}

async function save() {
  if (!selectedFile.value) return;
  saving.value = true;
  error.value = null;
  try {
    await auth.uploadAvatar(selectedFile.value);
    clearPreview();
    emit('close');
  } catch (e) {
    error.value = getApiError(e)?.message ?? 'Could not upload photo';
  } finally {
    saving.value = false;
  }
}

async function remove() {
  removing.value = true;
  error.value = null;
  try {
    await auth.removeAvatar();
    clearPreview();
  } catch (e) {
    error.value = getApiError(e)?.message ?? 'Could not remove photo';
  } finally {
    removing.value = false;
  }
}

onBeforeUnmount(clearPreview);
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-[#2b2640]/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg">
      <div class="flex items-start justify-between">
        <h2 class="text-lg font-semibold tracking-tight">Profile photo</h2>
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
            @click="remove"
          >
            {{ removing ? 'Removing…' : 'Remove' }}
          </button>
        </div>
      </div>

      <p
        v-if="error"
        class="mt-4 rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive-foreground"
      >
        {{ error }}
      </p>

      <div v-if="selectedFile" class="mt-5 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          @click="clearPreview"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="saving"
          class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save photo' }}
        </button>
      </div>
    </div>
  </div>
</template>
