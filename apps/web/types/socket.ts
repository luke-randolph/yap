import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@yap/contracts';

// The client listens for ServerToClient events and emits ClientToServer events
// (socket.io-client's type params are <ListenEvents, EmitEvents>).
export type ChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
