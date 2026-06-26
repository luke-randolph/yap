<script setup lang="ts">
import type { ConversationDTO } from '@yap/contracts';
import type { ChatMessage } from '~/stores/messages';

const props = defineProps<{
  reactions: ChatMessage['reactions'];
  participants: ConversationDTO['participants'];
}>();

const emit = defineEmits<{ toggle: [emoji: string] }>();

const auth = useAuthStore();

interface ReactionChip {
  emoji: string;
  count: number;
  isOwn: boolean;
  names: string[];
}

const nameById = computed(() => {
  const map = new Map<string, string>();
  for (const p of props.participants) map.set(p.user.id, p.user.displayName);
  return map;
});

const chips = computed<ReactionChip[]>(() => {
  const byEmoji = new Map<string, ReactionChip>();
  for (const r of props.reactions) {
    const chip = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, isOwn: false, names: [] };
    chip.count += 1;
    const isCurrentUser = r.userId === auth.user?.id;
    if (isCurrentUser) chip.isOwn = true;
    chip.names.push(isCurrentUser ? 'You' : (nameById.value.get(r.userId) ?? 'Unknown'));
    byEmoji.set(r.emoji, chip);
  }
  return [...byEmoji.values()];
});
</script>

<template>
  <div v-if="chips.length" class="mt-1 flex flex-wrap gap-1">
    <div v-for="chip in chips" :key="chip.emoji" class="group/chip relative">
      <button
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
      <span
        role="tooltip"
        class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md group-hover/chip:block"
      >
        {{ chip.names.join(', ') }}
      </span>
    </div>
  </div>
</template>
