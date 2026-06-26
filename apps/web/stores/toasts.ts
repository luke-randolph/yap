export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const DEFAULT_DURATION_MS = 4000;

export const useToastsStore = defineStore('toasts', () => {
  const items = ref<Toast[]>([]);

  function dismiss(id: string) {
    items.value = items.value.filter((t) => t.id !== id);
  }

  function push(message: string, type: ToastType = 'info', duration = DEFAULT_DURATION_MS) {
    const id = crypto.randomUUID();
    items.value.push({ id, type, message });
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }

  const success = (message: string, duration?: number) => push(message, 'success', duration);
  const error = (message: string, duration?: number) => push(message, 'error', duration);
  const info = (message: string, duration?: number) => push(message, 'info', duration);

  return { items, push, success, error, info, dismiss };
});
