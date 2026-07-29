<script setup lang="ts">
import type { EmojiClickEventDetail } from 'vuemoji-picker';

const props = withDefaults(defineProps<{ width?: string; height?: string }>(), {
  width: '320px',
  height: '380px',
});

const emit = defineEmits<{ select: [emoji: string] }>();

const VuemojiPicker = defineAsyncComponent(() =>
  import('vuemoji-picker').then((m) => m.VuemojiPicker),
);

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === 'dark');

const pickerStyle = computed(() => ({
  width: props.width,
  height: props.height,
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
}));

function onSelect(detail: EmojiClickEventDetail) {
  if (!detail.unicode) return;
  emit('select', detail.unicode);
}
</script>

<template>
  <VuemojiPicker :is-dark="isDark" :picker-style="pickerStyle" @emoji-click="onSelect" />
</template>
