export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown> | string;
  headers?: HeadersInit;
  query?: Record<string, string | number | boolean | null | undefined>;
}

export function useApi() {
  const auth = useAuthStore();
  const config = useRuntimeConfig();

  async function api<T = unknown>(request: string, opts: ApiOptions = {}): Promise<T> {
    const call = async (token: string | null): Promise<T> => {
      const headers = new Headers(opts.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const result = await $fetch(request, {
        method: opts.method,
        body: opts.body,
        query: opts.query,
        baseURL: config.public.apiBase,
        credentials: 'include',
        headers,
      });
      return result as T;
    };

    try {
      return await call(auth.accessToken);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 401 || request.startsWith('/auth/')) throw err;
      const ok = await auth.refresh();
      if (!ok) {
        await navigateTo('/login');
        throw err;
      }
      return await call(auth.accessToken);
    }
  }

  return api;
}
