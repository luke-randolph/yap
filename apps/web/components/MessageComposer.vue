<script setup lang="ts">
import { ImagePlus, Reply, SendHorizontal, Smile, X } from 'lucide-vue-next';
import { onClickOutside, onKeyStroke } from '@vueuse/core';
import type { EmojiClickEventDetail } from 'vuemoji-picker';
import { MESSAGE_IMAGE, VALIDATION_LIMITS } from '@yap/contracts';
import type { GifSelection } from '~/stores/messages';

const props = defineProps<{
  conversationId: string;
}>();

const messages = useMessagesStore();
const conversations = useConversationsStore();
const auth = useAuthStore();
const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');
const pickerStyle = {
  width: '320px',
  height: '380px',
  borderSize: '0',
  background: 'var(--card)',
  borderColor: 'var(--border)',
  indicatorColor: 'var(--primary)',
  inputBorderColor: 'var(--border)',
  inputFontColor: 'var(--foreground)',
  inputPlaceholderColor: 'var(--muted-foreground)',
  categoryFontColor: 'var(--muted-foreground)',
  buttonHoverBackground: 'var(--muted)',
  buttonActiveBackground: 'var(--accent)',
  outlineColor: 'var(--primary)',
};

const draft = ref('');

const EmojiPicker = defineAsyncComponent(() =>
  import('vuemoji-picker').then((m) => m.VuemojiPicker),
);

const textarea = ref<HTMLTextAreaElement | null>(null);
const emojiRoot = ref<HTMLElement | null>(null);
const emojiOpen = ref(false);
const gifRoot = ref<HTMLElement | null>(null);
const gifOpen = ref(false);

onClickOutside(emojiRoot, () => {
  emojiOpen.value = false;
});

onClickOutside(gifRoot, () => {
  gifOpen.value = false;
});

onKeyStroke('Escape', () => {
  if (emojiOpen.value) emojiOpen.value = false;
  if (gifOpen.value) gifOpen.value = false;
});

function toggleEmoji() {
  gifOpen.value = false;
  emojiOpen.value = !emojiOpen.value;
}

function toggleGif() {
  emojiOpen.value = false;
  gifOpen.value = !gifOpen.value;
}

function onGifSelect(gif: GifSelection) {
  const body = draft.value.trim();
  const parentMessageId = messages.replyTarget?.id ?? null;
  draft.value = '';
  messages.clearReplyTarget();
  gifOpen.value = false;
  void messages.sendGif(props.conversationId, gif, body, parentMessageId);
}

function insertEmoji(detail: EmojiClickEventDetail) {
  const char = detail.unicode;
  if (!char) return;
  const el = textarea.value;
  const start = el?.selectionStart ?? draft.value.length;
  const end = el?.selectionEnd ?? draft.value.length;
  const next = draft.value.slice(0, start) + char + draft.value.slice(end);
  if (next.length > VALIDATION_LIMITS.maxMessageBodyLength) return;
  draft.value = next;
  nextTick(() => {
    const pos = start + char.length;
    el?.focus();
    el?.setSelectionRange(pos, pos);
  });
}

const replyToName = computed(() => {
  const target = messages.replyTarget;
  if (!target) return '';
  if (target.senderId === auth.user?.id) return 'yourself';
  const participants = conversations.selected?.participants ?? [];
  return participants.find((p) => p.user.id === target.senderId)?.user.displayName ?? 'Unknown';
});

const replySnippet = computed(() => messages.replyTarget?.body ?? 'Attachment');

const fileInput = ref<HTMLInputElement | null>(null);
const pendingFile = ref<File | null>(null);
const pendingPreview = ref<string | null>(null);
const photoError = ref<string | null>(null);

function pickImage() {
  photoError.value = null;
  fileInput.value?.click();
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  if (!MESSAGE_IMAGE.allowedMimeTypes.some((t) => t === file.type)) {
    photoError.value = 'Please choose a JPEG, PNG, WebP, or GIF image.';
    return;
  }
  if (file.size > MESSAGE_IMAGE.maxUploadBytes) {
    photoError.value = `Image must be under ${Math.round(MESSAGE_IMAGE.maxUploadBytes / 1024 / 1024)} MB.`;
    return;
  }
  clearPending();
  pendingFile.value = file;
  pendingPreview.value = URL.createObjectURL(file);
}

function clearPending() {
  if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
  pendingPreview.value = null;
  pendingFile.value = null;
  photoError.value = null;
}

onBeforeUnmount(clearPending);

async function send() {
  const body = draft.value.trim();
  const file = pendingFile.value;
  if (!body && !file) return;
  const parentMessageId = messages.replyTarget?.id ?? null;
  draft.value = '';
  messages.clearReplyTarget();
  if (file) {
    pendingFile.value = null;
    if (pendingPreview.value) URL.revokeObjectURL(pendingPreview.value);
    pendingPreview.value = null;
    await messages.sendImage(props.conversationId, file, body, parentMessageId);
  } else {
    await messages.send(props.conversationId, body, parentMessageId);
  }
}
</script>

<template>
  <form class="border-t border-border bg-card px-4 py-3" @submit.prevent="send">
    <div
      v-if="messages.replyTarget"
      class="mb-2 flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
    >
      <Reply class="h-4 w-4 shrink-0 text-accent-foreground/70" />
      <div class="min-w-0 flex-1">
        <p class="text-xs font-medium">Replying to {{ replyToName }}</p>
        <p class="truncate text-xs text-accent-foreground/70">{{ replySnippet }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
        title="Cancel reply"
        @click="messages.clearReplyTarget()"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
    <div v-if="pendingPreview" class="mb-2">
      <div class="relative inline-block">
        <img
          :src="pendingPreview"
          alt="Selected image"
          class="h-20 w-20 rounded-md border border-border object-cover"
        />
        <button
          type="button"
          class="absolute -right-2 -top-2 rounded-full border border-border bg-card p-0.5 text-muted-foreground hover:text-foreground"
          title="Remove image"
          @click="clearPending"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    <p v-if="photoError" class="mb-2 text-xs text-destructive-foreground">{{ photoError }}</p>
    <div class="flex items-end gap-2">
      <div ref="emojiRoot" class="relative self-center">
        <button
          type="button"
          class="flex items-center justify-center rounded-md text-muted-foreground transition-colors p-3 border border-border hover:bg-muted hover:text-foreground"
          title="Emoji"
          @click="toggleEmoji"
        >
          <Smile class="h-4 w-4" />
        </button>

        <div
          v-if="emojiOpen"
          class="absolute bottom-full left-0 z-10 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <div class="flex items-center justify-end px-2 py-1">
            <button
              type="button"
              class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Close"
              @click="emojiOpen = false"
            >
              <X class="h-4 w-4" />
            </button>
          </div>
          <EmojiPicker :is-dark="isDark" :picker-style="pickerStyle" @emoji-click="insertEmoji" />
        </div>
      </div>
      <div ref="gifRoot" class="relative self-center">
        <button
          type="button"
          class="flex h-10 items-center justify-center rounded-md border border-border px-3 text-sm font-bold leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="GIF"
          @click="toggleGif"
        >
          GIF
        </button>

        <div
          v-if="gifOpen"
          class="absolute bottom-full left-0 z-10 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          <GifPicker @select="onGifSelect" @close="gifOpen = false" />
        </div>
      </div>
      <button
        type="button"
        class="flex items-center justify-center self-center rounded-md border border-border p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Add photo"
        @click="pickImage"
      >
        <ImagePlus class="h-4 w-4" />
      </button>
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        :accept="MESSAGE_IMAGE.allowedMimeTypes.join(',')"
        @change="onFileChange"
      />
      <textarea
        ref="textarea"
        v-model="draft"
        rows="1"
        :maxlength="VALIDATION_LIMITS.maxMessageBodyLength"
        placeholder="Type a message…"
        class="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        @keydown.enter.exact.prevent="send"
      />
      <button
        type="submit"
        :disabled="!draft.trim() && !pendingFile"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        title="Send"
      >
        <SendHorizontal class="h-4 w-4" />
      </button>
    </div>
  </form>
</template>
