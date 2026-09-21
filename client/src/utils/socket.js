import { io } from 'socket.io-client';

// Determine backend URL
const getBackendUrl = () => {
  // 1. Check custom stored URL in localStorage
  const savedUrl = localStorage.getItem('movteg_server_url');
  if (savedUrl) return savedUrl;

  // 2. Check environment variable (Vite)
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  // 3. If running on localhost
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:4000';
  }

  // 4. Default fallback: same origin (for fullstack deployment)
  return window.location.origin;
};

export const SERVER_URL = getBackendUrl();

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

export const updateServerUrl = (newUrl) => {
  if (!newUrl) return;
  localStorage.setItem('movteg_server_url', newUrl);
  window.location.reload();
};
