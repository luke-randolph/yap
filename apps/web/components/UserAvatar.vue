<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    name: string;
    src?: string | null;
    size?: number;
  }>(),
  { src: null, size: 32 },
);

const config = useRuntimeConfig();
const failed = ref(false);

watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);

const resolvedSrc = computed(() => resolveMediaUrl(props.src, config.public.apiBase));

const showImage = computed(() => !!resolvedSrc.value && !failed.value);
const initial = computed(() => props.name?.trim().charAt(0).toUpperCase() || '?');

const dimStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  fontSize: `${Math.max(12, Math.round(props.size * 0.45))}px`,
}));
</script>

<template>
  <span
    role="img"
    :aria-label="name"
    :style="dimStyle"
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium leading-none select-none"
  >
    <img
      v-if="showImage"
      :src="resolvedSrc!"
      alt=""
      aria-hidden="true"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
    <span v-else aria-hidden="true" class="text-[#A78BFA]">{{ initial }}</span>
  </span>
</template>
