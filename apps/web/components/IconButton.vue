<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string;
    size?: 'sm' | 'md';
    tone?: 'default' | 'success' | 'destructive' | 'destructive-on-hover';
    disabled?: boolean;
  }>(),
  { size: 'sm', tone: 'default', disabled: false },
);

const TONE_CLASSES = {
  default: 'text-muted-foreground hover:text-foreground',
  success: 'text-success',
  destructive: 'text-destructive',
  'destructive-on-hover': 'text-muted-foreground hover:text-destructive',
};

const toneClass = computed(() => TONE_CLASSES[props.tone]);
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :title="label"
    :aria-label="label"
    class="rounded-md transition-colors hover:bg-muted disabled:opacity-50"
    :class="[size === 'md' ? 'p-1.5' : 'p-1', toneClass]"
  >
    <slot />
  </button>
</template>
