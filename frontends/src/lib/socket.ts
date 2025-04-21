// src/lib/socket.ts
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
      transports: ['websocket', 'polling'],
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

export function joinDocRoom(docId: string): void {
  try {
    const s = getSocket();
    s.emit('join_doc', { doc_id: docId });
  } catch (error) {
    console.error('Error joining doc room:', error);
  }
}

export function leaveDocRoom(docId: string): void {
  try {
    const s = getSocket();
    s.emit('leave_doc', { doc_id: docId });
  } catch (error) {
    console.error('Error leaving doc room:', error);
  }
}

export function updateDocContent(docId: string, content: string): void {
  try {
    const s = getSocket();
    s.emit('edit_doc', { doc_id: docId, content });
  } catch (error) {
    console.error('Error updating doc content:', error);
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
