<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';

defineEmits<{
  exit: [];
}>();
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent px-4 py-1.5 text-center text-sm text-accent-foreground"
  >
    <span class="flex items-center gap-1.5">
      <Sparkles class="h-4 w-4 shrink-0" />
      Demo mode — you're viewing sample accounts. Your activity here is private and isn't visible to
      anyone else.
    </span>
    <button
      type="button"
      class="rounded-full border border-accent-foreground/30 px-3 py-0.5 text-sm font-medium hover:bg-accent-foreground/10"
      @click="$emit('exit')"
    >
      Exit demo
    </button>
  </div>
</template>
