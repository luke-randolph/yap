import type { UserPublicDTO } from '@yap/contracts';

const DEBOUNCE_MS = 200;

interface UserSearchOptions {
  filter?: (user: UserPublicDTO) => boolean;
}

export function useUserSearch(options: UserSearchOptions = {}) {
  const query = ref('');
  const results = ref<UserPublicDTO[]>([]);
  const searching = ref(false);

  let timer: ReturnType<typeof setTimeout> | null = null;
  // Only the newest request may write to results; slower earlier ones are discarded.
  let latestRequest = 0;

  // Also drops any in-flight response so it can't repopulate the list.
  function clear(): void {
    latestRequest++;
    results.value = [];
    searching.value = false;
  }

  async function run(term: string): Promise<void> {
    const request = ++latestRequest;
    searching.value = true;
    try {
      const api = useApi();
      const found = await api<UserPublicDTO[]>('/users/search', { query: { q: term } });
      if (request !== latestRequest) return;
      results.value = options.filter ? found.filter(options.filter) : found;
    } catch {
      if (request === latestRequest) results.value = [];
    } finally {
      if (request === latestRequest) searching.value = false;
    }
  }

  watch(query, (value) => {
    if (timer) clearTimeout(timer);
    const trimmed = value.trim();
    if (!trimmed) {
      clear();
      return;
    }
    timer = setTimeout(() => void run(trimmed), DEBOUNCE_MS);
  });

  onScopeDispose(() => {
    if (timer) clearTimeout(timer);
    latestRequest++;
  });

  return { query, results, searching, clear };
}
