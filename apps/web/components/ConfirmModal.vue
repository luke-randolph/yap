<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    loading?: boolean;
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel', danger: false, loading: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <BaseOverlay @close="emit('cancel')">
    <h2 class="text-base font-semibold tracking-tight">{{ title }}</h2>
    <p class="mt-2 text-sm text-muted-foreground">{{ message }}</p>
    <div class="mt-6 flex justify-end gap-2">
      <button
        type="button"
        :disabled="loading"
        class="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        @click="emit('cancel')"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="button"
        :disabled="loading"
        class="rounded-md px-4 py-2 text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        :class="danger ? 'bg-destructive-solid text-white' : 'bg-primary text-primary-foreground'"
        @click="emit('confirm')"
      >
        {{ loading ? 'Working…' : confirmLabel }}
      </button>
    </div>
  </BaseOverlay>
</template>
