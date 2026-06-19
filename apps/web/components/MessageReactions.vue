<script setup lang="ts">
import type { ChatMessage } from '~/stores/messages';

const props = defineProps<{
  reactions: ChatMessage['reactions'];
}>();

const emit = defineEmits<{ toggle: [emoji: string] }>();

const auth = useAuthStore();

interface ReactionChip {
  emoji: string;
  count: number;
  isOwn: boolean;
}

const chips = computed<ReactionChip[]>(() => {
  const byEmoji = new Map<string, ReactionChip>();
  for (const r of props.reactions) {
    const chip = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, isOwn: false };
    chip.count += 1;
    if (r.userId === auth.user?.id) chip.isOwn = true;
    byEmoji.set(r.emoji, chip);
  }
  return [...byEmoji.values()];
});
</script>

<template>
  <div v-if="chips.length" class="mt-1 flex flex-wrap gap-1">
    <button
      v-for="chip in chips"
      :key="chip.emoji"
      type="button"
      class="flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs leading-none transition-colors"
      :class="
        chip.isOwn
          ? 'border-primary bg-accent text-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-muted'
      "
      @click="emit('toggle', chip.emoji)"
    >
      <span>{{ chip.emoji }}</span>
      <span v-if="chip.count > 1" class="font-medium">{{ chip.count }}</span>
    </button>
  </div>
</template>
