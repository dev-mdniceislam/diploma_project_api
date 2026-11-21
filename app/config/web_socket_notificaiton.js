// src/realtime/socket.js
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

let io;
const onlineUsers = new Map(); // userId -> Set<socketId>

export function initSocket(httpServer, allowedOrigins) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;
    socket.join(`user:${uid}`); // প্রতিটা user-এর আলাদা room
    if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
    onlineUsers.get(uid).add(socket.id);

    socket.on('disconnect', () => {
      const set = onlineUsers.get(uid);
      set?.delete(socket.id);
      if (set?.size === 0) onlineUsers.delete(uid);
    });
  });
}

export const isOnline = (userId) => onlineUsers.has(String(userId));
export const getIO = () => io;
