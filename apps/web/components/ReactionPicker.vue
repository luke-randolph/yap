<script setup lang="ts">
import { SmilePlus } from 'lucide-vue-next';
import { onClickOutside, onKeyStroke } from '@vueuse/core';

withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'right' });

const EmojiPicker = defineAsyncComponent(async () => {
  await import('vue3-emoji-picker/css');
  return (await import('vue3-emoji-picker')).default;
});

const emit = defineEmits<{ select: [emoji: string] }>();

const colorMode = useColorMode();
const pickerTheme = computed<'light' | 'dark'>(() => (colorMode.value === 'dark' ? 'dark' : 'light'));

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLElement | null>(null);
const open = ref(false);
const placement = ref<'top' | 'bottom'>('top');

const PANEL_HEIGHT = 380;

onClickOutside(root, () => {
  open.value = false;
});

onKeyStroke('Escape', () => {
  if (open.value) open.value = false;
});

function toggle() {
  if (!open.value) {
    const rect = trigger.value?.getBoundingClientRect();
    placement.value = rect && rect.top < PANEL_HEIGHT ? 'bottom' : 'top';
  }
  open.value = !open.value;
}

function onSelect(emoji: { i: string }) {
  emit('select', emoji.i);
  open.value = false;
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      title="React"
      @click="toggle"
    >
      <SmilePlus class="h-4 w-4" />
    </button>

    <div
      v-if="open"
      class="absolute z-10 overflow-hidden rounded-lg shadow-lg"
      :class="[
        placement === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
        align === 'right' ? 'right-0' : 'left-0',
      ]"
    >
      <EmojiPicker :native="true" :display-recent="true" :theme="pickerTheme" @select="onSelect" />
    </div>
  </div>
</template>
