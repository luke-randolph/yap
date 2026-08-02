<script setup lang="ts">
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    src: string;
    alt?: string;
    width?: number | null;
    height?: number | null;
  }>(),
  { alt: 'Shared photo', width: null, height: null },
);

const emit = defineEmits<{ close: [] }>();

// Grow to the viewport but never past the stored pixels, so nothing is upscaled.
const boundsStyle = computed(() => ({
  maxWidth: props.width ? `min(92vw, ${props.width}px)` : undefined,
  maxHeight: props.height ? `min(88vh, ${props.height}px)` : undefined,
}));
</script>

<template>
  <OverlayBackdrop role="dialog" aria-modal="true" aria-label="Photo" @close="emit('close')">
    <img
      :src="src"
      :alt="alt"
      class="max-h-[88vh] max-w-[92vw] rounded-lg shadow-lg"
      :style="boundsStyle"
    />
    <button
      type="button"
      title="Close photo"
      aria-label="Close photo"
      class="fixed right-4 top-[calc(1rem+env(safe-area-inset-top))] rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
      @click="emit('close')"
    >
      <X class="h-5 w-5" />
    </button>
  </OverlayBackdrop>
</template>
