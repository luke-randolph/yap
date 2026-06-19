<script setup lang="ts">
import { Reply } from 'lucide-vue-next';

defineEmits<{ reply: [] }>();
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      type="button"
      class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      title="Reply"
      @click="$emit('reply')"
    >
      <Reply class="h-4 w-4" />
    </button>
  </div>
</template>
