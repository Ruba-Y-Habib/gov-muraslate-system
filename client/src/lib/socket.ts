import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

export function connectSocket(onNewMail: (payload: any) => void): Socket {
  disconnectSocket();
  socket = io('/', {
    auth: { token: getToken() },
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });
  socket.on('new-mail', onNewMail);
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
