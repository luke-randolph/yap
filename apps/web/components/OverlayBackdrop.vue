<script setup lang="ts">
import { onKeyStroke } from '@vueuse/core';

const props = withDefaults(
  defineProps<{
    position?: 'center' | 'bottom';
    dismissible?: boolean;
  }>(),
  { position: 'center', dismissible: true },
);

const emit = defineEmits<{ close: [] }>();

const { zIndex, isTopmost } = useOverlayStack();

function dismiss(): void {
  if (props.dismissible) emit('close');
}

onKeyStroke('Escape', (event) => {
  if (!props.dismissible || !isTopmost()) return;
  event.preventDefault();
  emit('close');
});
</script>

<template>
  <div
    class="fixed inset-0 flex bg-overlay/55 backdrop-blur-sm"
    :class="position === 'bottom' ? 'flex-col justify-end' : 'items-center justify-center'"
    :style="{ zIndex }"
    @click.self="dismiss"
  >
    <slot />
  </div>
</template>
