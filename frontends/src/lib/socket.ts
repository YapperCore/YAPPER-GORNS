// src/lib/socket.ts - Updated socket implementation
'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (typeof window === 'undefined') {
    throw new Error('Cannot create socket on server side');
  }
  
  if (!socket) {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin;
    
    socket = io(backendUrl, {
      path: '/socket.io',
      transports: ['polling', 'websocket'], // Change order: polling first, then websocket
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    
    socket.on('connect', () => {
      console.log('Socket connected:', socket?.id);
    });
    
    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });
  }
  
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
