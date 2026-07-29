<script setup lang="ts">
import { Copy, Pin, PinOff, Reply, SmilePlus, Trash2, X } from 'lucide-vue-next';
import { onKeyStroke } from '@vueuse/core';

defineProps<{
  preview: string;
  pinned: boolean;
  canCopy: boolean;
  canDelete: boolean;
  currentEmoji?: string;
}>();

const emit = defineEmits<{
  react: [emoji: string];
  reply: [];
  pin: [];
  copy: [];
  delete: [];
  close: [];
}>();

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const showFullPicker = ref(false);

onKeyStroke('Escape', () => emit('close'));
</script>

<template>
  <div
    class="fixed inset-0 z-[60] flex flex-col justify-end bg-overlay/55 backdrop-blur-sm"
    @click.self="emit('close')"
  >
    <Transition
      appear
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="translate-y-full"
    >
      <div
        role="dialog"
        aria-modal="true"
        class="w-full rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-lg"
      >
        <div class="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ preview }}</p>
          <button
            type="button"
            class="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div v-if="showFullPicker" class="flex justify-center px-3 py-3">
          <div class="w-full">
            <EmojiPicker width="100%" @select="emit('react', $event)" />
          </div>
        </div>

        <template v-else>
          <div class="flex items-center justify-between gap-1 px-3 py-3">
            <button
              v-for="emoji in QUICK_REACTIONS"
              :key="emoji"
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full text-2xl transition-colors"
              :class="emoji === currentEmoji ? 'bg-accent ring-1 ring-primary' : 'hover:bg-muted'"
              @click="emit('react', emoji)"
            >
              {{ emoji }}
            </button>
            <button
              type="button"
              class="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="More emoji"
              @click="showFullPicker = true"
            >
              <SmilePlus class="h-5 w-5" />
            </button>
          </div>

          <div class="border-t border-border py-1">
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted"
              @click="emit('reply')"
            >
              <Reply class="h-4 w-4 text-muted-foreground" />
              Reply
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted"
              @click="emit('pin')"
            >
              <PinOff v-if="pinned" class="h-4 w-4 text-muted-foreground" />
              <Pin v-else class="h-4 w-4 text-muted-foreground" />
              {{ pinned ? 'Unpin' : 'Pin' }}
            </button>
            <button
              v-if="canCopy"
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted"
              @click="emit('copy')"
            >
              <Copy class="h-4 w-4 text-muted-foreground" />
              Copy text
            </button>
            <button
              v-if="canDelete"
              type="button"
              class="flex w-full items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive-soft"
              @click="emit('delete')"
            >
              <Trash2 class="h-4 w-4" />
              Unsend
            </button>
          </div>
        </template>
      </div>
    </Transition>
  </div>
</template>
