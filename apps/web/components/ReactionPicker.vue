<script setup lang="ts">
import { SmilePlus } from 'lucide-vue-next';
import { onClickOutside, onKeyStroke } from '@vueuse/core';
import type { EmojiClickEventDetail } from 'vuemoji-picker';

withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'right' });

const EmojiPicker = defineAsyncComponent(() =>
  import('vuemoji-picker').then((m) => m.VuemojiPicker),
);

const emit = defineEmits<{ select: [emoji: string] }>();

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

function onSelect(detail: EmojiClickEventDetail) {
  if (!detail.unicode) return;
  emit('select', detail.unicode);
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
      <EmojiPicker :is-dark="isDark" :picker-style="pickerStyle" @emoji-click="onSelect" />
    </div>
  </div>
</template>
