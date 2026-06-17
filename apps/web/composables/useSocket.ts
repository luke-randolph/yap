import type { ChatSocket } from '~/plugins/socket.client';

export interface SocketHandle {
  get(): ChatSocket | null;
  ensureConnected(): ChatSocket | null;
  disconnect(): void;
}

export function useSocket(): SocketHandle {
  const { $chatSocket } = useNuxtApp();
  return $chatSocket as SocketHandle;
}
