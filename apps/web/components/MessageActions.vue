<script setup lang="ts">
import { Reply } from 'lucide-vue-next';

withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'right' });

defineEmits<{ reply: []; react: [emoji: string] }>();
</script>

<template>
  <div class="flex items-center gap-1">
    <ReactionPicker :align="align" @select="$emit('react', $event)" />
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
