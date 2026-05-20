import type { FetchOptions } from 'ofetch';

export function useApi() {
  const auth = useAuthStore();
  const config = useRuntimeConfig();

  async function api<T = unknown>(
    request: string,
    opts: FetchOptions = {},
  ): Promise<T> {
    const call = (token: string | null) => {
      const headers = new Headers(opts.headers as HeadersInit | undefined);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return $fetch<T>(request, {
        ...opts,
        baseURL: config.public.apiBase,
        credentials: 'include',
        headers,
      } as FetchOptions);
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
