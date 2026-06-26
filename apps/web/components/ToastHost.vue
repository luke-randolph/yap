<script setup lang="ts">
import { Check, CircleAlert, Info, X } from 'lucide-vue-next';

const toasts = useToastsStore();

const styles: Record<string, string> = {
  success: 'border-success bg-success-soft text-success-foreground',
  error: 'border-destructive bg-destructive-soft text-destructive-foreground',
  info: 'border-border bg-card text-foreground',
};
const icons = { success: Check, error: CircleAlert, info: Info };
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
    >
      <TransitionGroup
        enter-from-class="translate-y-2 opacity-0"
        enter-active-class="transition duration-200 ease-out"
        leave-active-class="transition duration-150 ease-in"
        leave-to-class="translate-y-2 opacity-0"
        move-class="transition duration-200"
      >
        <div
          v-for="t in toasts.items"
          :key="t.id"
          role="status"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg"
          :class="styles[t.type]"
        >
          <component :is="icons[t.type]" class="mt-0.5 h-4 w-4 shrink-0" />
          <span class="min-w-0 flex-1 break-words">{{ t.message }}</span>
          <button
            type="button"
            class="-mr-1 shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
            @click="toasts.dismiss(t.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
