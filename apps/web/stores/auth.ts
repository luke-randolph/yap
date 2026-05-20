import { defineStore } from 'pinia';
import {
  AUTH_ERROR_CODES,
  type AuthTokenResponse,
  type UserPublicDTO,
  type VerifyOtpInput,
} from '@yap/contracts';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<UserPublicDTO | null>(null);
  const isAuthenticated = computed(() => !!accessToken.value);

  let refreshing: Promise<boolean> | null = null;

  function setSession(payload: AuthTokenResponse) {
    accessToken.value = payload.accessToken;
    user.value = payload.user;
  }

  function clearSession() {
    accessToken.value = null;
    user.value = null;
  }

  function authFetch<T>(path: string, init?: { method?: string; body?: unknown }) {
    const config = useRuntimeConfig();
    return $fetch<T>(path, {
      baseURL: config.public.apiBase,
      credentials: 'include',
      method: init?.method,
      body: init?.body,
    });
  }

  async function requestOtp(email: string): Promise<void> {
    await authFetch('/auth/otp/request', { method: 'POST', body: { email } });
  }

  async function verifyOtp(input: VerifyOtpInput): Promise<'ok' | 'needs_display_name'> {
    try {
      const res = await authFetch<AuthTokenResponse>('/auth/otp/verify', {
        method: 'POST',
        body: input,
      });
      setSession(res);
      return 'ok';
    } catch (e: unknown) {
      const code = (e as { data?: { error?: { code?: string } } })?.data?.error?.code;
      if (code === AUTH_ERROR_CODES.displayNameRequired) return 'needs_display_name';
      throw e;
    }
  }

  async function refresh(): Promise<boolean> {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const res = await authFetch<AuthTokenResponse>('/auth/refresh', { method: 'POST' });
        setSession(res);
        return true;
      } catch {
        clearSession();
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function logout(): Promise<void> {
    try {
      await authFetch('/auth/logout', { method: 'POST' });
    } catch {
      // best-effort: still clear local state if server call fails
    }
    clearSession();
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    setSession,
    clearSession,
    requestOtp,
    verifyOtp,
    refresh,
    logout,
  };
});
