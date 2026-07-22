<script setup lang="ts">
import { Search, X } from 'lucide-vue-next';
import type { GifDTO, GifSearchResponseDTO } from '@yap/contracts';
import type { GifSelection } from '~/stores/messages';

const emit = defineEmits<{
  select: [gif: GifSelection];
  close: [];
}>();

const query = ref('');
const results = ref<GifDTO[]>([]);
const next = ref<string | null>(null);
const loading = ref(false);
const errored = ref(false);
const scroller = ref<HTMLElement | null>(null);

// Fetch a page. `reset` starts a fresh query; otherwise appends the next page.
async function fetchPage(reset: boolean): Promise<void> {
  if (loading.value) return;
  if (!reset && next.value === null && results.value.length > 0) return;
  loading.value = true;
  errored.value = false;
  try {
    const api = useApi();
    const res = await api<GifSearchResponseDTO>('/gifs/search', {
      query: {
        q: query.value.trim() || undefined,
        pos: reset ? undefined : (next.value ?? undefined),
      },
    });
    if (reset) {
      results.value = res.results;
    } else {
      const seen = new Set(results.value.map((g) => g.id));
      results.value = [...results.value, ...res.results.filter((g) => !seen.has(g.id))];
    }
    next.value = res.next;
  } catch {
    errored.value = true;
  } finally {
    loading.value = false;
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(query, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (scroller.value) scroller.value.scrollTop = 0;
    fetchPage(true);
  }, 200);
});

function onScroll(): void {
  const el = scroller.value;
  if (!el || loading.value || next.value === null) return;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) fetchPage(false);
}

function choose(gif: GifDTO): void {
  emit('select', {
    gifId: gif.id,
    previewUrl: gif.previewUrl,
    width: gif.width,
    height: gif.height,
  });
}

onMounted(() => fetchPage(true));
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <div class="flex h-[380px] w-80 flex-col">
    <div class="flex items-center gap-2 border-b border-border px-2 py-2">
      <div class="relative flex-1">
        <Search
          class="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          v-model="query"
          type="text"
          placeholder="Search GIFs"
          class="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <button
        type="button"
        class="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Close"
        @click="emit('close')"
      >
        <X class="h-4 w-4" />
      </button>
    </div>

    <div ref="scroller" class="flex-1 overflow-y-auto p-2" @scroll="onScroll">
      <p v-if="errored" class="py-8 text-center text-sm text-muted-foreground">
        Couldn't load GIFs. Try again.
      </p>
      <p
        v-else-if="!loading && results.length === 0"
        class="py-8 text-center text-sm text-muted-foreground"
      >
        No GIFs found.
      </p>
      <div v-else class="columns-2 gap-2 [&>*]:mb-2">
        <button
          v-for="gif in results"
          :key="gif.id"
          type="button"
          class="block w-full overflow-hidden rounded-md border border-border transition-opacity hover:opacity-80"
          @click="choose(gif)"
        >
          <img
            :src="gif.previewUrl"
            :alt="gif.description || 'GIF'"
            loading="lazy"
            class="w-full"
          />
        </button>
      </div>
      <p v-if="loading" class="py-3 text-center text-xs text-muted-foreground">Loading…</p>
    </div>

    <div class="border-t border-border px-3 py-1.5 text-center text-xs text-muted-foreground">
      Powered by GIPHY
    </div>
  </div>
</template>
