import { defineStore } from 'pinia';
import {
  AUTH_ERROR_CODES,
  getApiError,
  type AuthTokenResponse,
  type UserPublicDTO,
  type VerifyOtpInput,
} from '@yap/contracts';

const HAS_NAME = (u: UserPublicDTO | null): boolean => !!u && u.displayName.trim().length > 0;

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null);
  const user = ref<UserPublicDTO | null>(null);
  const isAuthenticated = computed(() => !!accessToken.value);
  const needsDisplayName = computed(() => isAuthenticated.value && !HAS_NAME(user.value));

  let refreshing: Promise<boolean> | null = null;
  let sessionCheck: Promise<boolean> | null = null;

  function setSession(payload: AuthTokenResponse) {
    sessionCheck = Promise.resolve(true);
    accessToken.value = payload.accessToken;
    user.value = payload.user;
  }

  function clearSession() {
    sessionCheck = Promise.resolve(false);
    accessToken.value = null;
    user.value = null;
  }

  // For route guards; reuses the previous result. refresh() always re-probes.
  function ensureSession(): Promise<boolean> {
    if (isAuthenticated.value) return Promise.resolve(true);
    sessionCheck ??= refresh();
    return sessionCheck;
  }

  async function authFetch<T>(
    path: string,
    init?: { method?: 'GET' | 'POST'; body?: Record<string, unknown> },
  ): Promise<T> {
    const config = useRuntimeConfig();
    const result = await $fetch(path, {
      baseURL: config.public.apiBase,
      credentials: 'include',
      method: init?.method,
      body: init?.body,
    });
    return result as T;
  }

  async function requestOtp(email: string): Promise<void> {
    await authFetch('/auth/otp/request', { method: 'POST', body: { email } });
  }

  async function demoLogin(): Promise<void> {
    const res = await authFetch<AuthTokenResponse>('/auth/demo', { method: 'POST' });
    setSession(res);
  }

  async function requestAccess(email: string, displayName?: string): Promise<void> {
    await authFetch('/auth/access-request', {
      method: 'POST',
      body: { email, ...(displayName ? { displayName } : {}) },
    });
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
      const code = getApiError(e)?.code;
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

  async function updateProfile(displayName: string): Promise<void> {
    const api = useApi();
    user.value = await api<UserPublicDTO>('/users/me', {
      method: 'PATCH',
      body: { displayName },
    });
  }

  async function uploadAvatar(file: File): Promise<void> {
    const api = useApi();
    const form = new FormData();
    form.append('file', file);
    user.value = await api<UserPublicDTO>('/users/me/avatar', { method: 'POST', body: form });
  }

  async function removeAvatar(): Promise<void> {
    const api = useApi();
    user.value = await api<UserPublicDTO>('/users/me/avatar', { method: 'DELETE' });
  }

  async function logout(): Promise<void> {
    const request = authFetch('/auth/logout', { method: 'POST' });
    clearSession();
    await request.catch(() => undefined);
  }

  async function exitDemo(): Promise<void> {
    const api = useApi();
    // Must start before clearSession(): the request authenticates with the current token.
    const request = api('/auth/demo/exit', { method: 'POST' });
    clearSession();
    await request.catch(() => undefined);
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    needsDisplayName,
    setSession,
    clearSession,
    ensureSession,
    requestOtp,
    demoLogin,
    requestAccess,
    verifyOtp,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    refresh,
    logout,
    exitDemo,
  };
});
