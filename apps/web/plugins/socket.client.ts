import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@yap/contracts';

export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export default defineNuxtPlugin(() => {
  const auth = useAuthStore();
  const config = useRuntimeConfig();

  let socket: ChatSocket | null = null;

  function get(): ChatSocket | null {
    return socket;
  }

  function ensureConnected(): ChatSocket | null {
    const token = auth.accessToken;
    if (!token) return null;

    if (socket) {
      socket.auth = { token };
      if (!socket.connected) socket.connect();
      return socket;
    }

    socket = io(config.public.apiBase, {
      autoConnect: true,
      transports: ['websocket'],
      auth: { token },
    }) as ChatSocket;
    return socket;
  }

  function disconnect(): void {
    socket?.disconnect();
    socket = null;
  }

  watch(
    () => auth.accessToken,
    (token) => {
      if (token) ensureConnected();
      else disconnect();
    },
    { immediate: true },
  );

  return {
    provide: {
      chatSocket: { get, ensureConnected, disconnect },
    },
  };
});
