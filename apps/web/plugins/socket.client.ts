import { io } from 'socket.io-client';
import type { ChatSocket } from '~/types/socket';

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
      if (!token) {
        disconnect();
        return;
      }
      // A live socket only authenticates at handshake, so hand it the refreshed
      // token over `auth.refresh` to keep the session valid without reconnecting.
      // Updating `socket.auth` also covers any future reconnect.
      if (socket?.connected) {
        socket.auth = { token };
        socket.emit('auth.refresh', { accessToken: token });
      } else {
        ensureConnected();
      }
    },
    { immediate: true },
  );

  return {
    provide: {
      chatSocket: { get, ensureConnected, disconnect },
    },
  };
});
