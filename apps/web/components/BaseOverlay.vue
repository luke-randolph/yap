<script setup lang="ts">
import { X } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    position?: 'center' | 'bottom';
    size?: 'sm' | 'md';
    padded?: boolean;
    scrollable?: boolean;
    dismissible?: boolean;
    title?: string;
    description?: string;
    closable?: boolean;
  }>(),
  {
    position: 'center',
    size: 'sm',
    padded: true,
    scrollable: false,
    dismissible: true,
    title: undefined,
    description: undefined,
    closable: undefined,
  },
);

const emit = defineEmits<{ close: [] }>();

const showClose = computed(() => props.closable ?? props.dismissible);

const panelClass = computed(() =>
  props.position === 'bottom'
    ? [
        'w-full rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-lg',
        props.padded ? 'p-6' : '',
      ]
    : [
        'w-full rounded-xl border border-border bg-card shadow-lg',
        props.size === 'md' ? 'max-w-md' : 'max-w-sm',
        props.padded ? 'p-6' : '',
        props.scrollable ? 'flex max-h-[85vh] flex-col' : '',
      ],
);
</script>

<template>
  <OverlayBackdrop :position="position" :dismissible="dismissible" @close="emit('close')">
    <Transition
      appear
      :css="position === 'bottom'"
      enter-active-class="transition-transform duration-200 ease-out"
      enter-from-class="translate-y-full"
    >
      <div role="dialog" aria-modal="true" :class="panelClass">
        <div
          v-if="title"
          class="flex items-start justify-between"
          :class="padded ? '' : 'p-6 pb-3'"
        >
          <div>
            <h2 class="text-lg font-semibold tracking-tight">{{ title }}</h2>
            <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
          </div>
          <IconButton v-if="showClose" label="Close" @click="emit('close')">
            <X class="h-4 w-4" />
          </IconButton>
        </div>
        <slot />
      </div>
    </Transition>
  </OverlayBackdrop>
</template>
