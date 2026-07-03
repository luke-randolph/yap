<script setup lang="ts">
import { Pin, PinOff, Reply, Trash2 } from 'lucide-vue-next';

withDefaults(defineProps<{ align?: 'left' | 'right'; pinned?: boolean; canDelete?: boolean }>(), {
  align: 'right',
  pinned: false,
  canDelete: false,
});

defineEmits<{ reply: []; react: [emoji: string]; pin: []; delete: [] }>();
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
    <button
      type="button"
      class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      :title="pinned ? 'Unpin' : 'Pin'"
      @click="$emit('pin')"
    >
      <PinOff v-if="pinned" class="h-4 w-4" />
      <Pin v-else class="h-4 w-4" />
    </button>
    <button
      v-if="canDelete"
      type="button"
      class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
      title="Unsend"
      @click="$emit('delete')"
    >
      <Trash2 class="h-4 w-4" />
    </button>
  </div>
</template>
