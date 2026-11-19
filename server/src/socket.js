import { Server } from 'socket.io';
import { verifyToken } from './auth.js';

let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return next(new Error('unauthorized'));
    }
    socket.data.userId = payload.sub;
    next();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  return io;
}

// Push a live notification to one user's room
export function notifyUser(userId, payload) {
  if (io) {
    io.to(`user:${userId}`).emit('new-mail', payload);
  }
}

export function getIo() {
  return io;
}
