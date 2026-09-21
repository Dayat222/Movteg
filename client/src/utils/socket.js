import { io } from 'socket.io-client';
import { p2pSync } from './p2pSync';

const savedUrl = typeof window !== 'undefined' ? localStorage.getItem('movteg_server_url') : null;
const envUrl = import.meta.env.VITE_SERVER_URL;

// If custom server URL is explicitly configured
const customServerUrl = savedUrl || envUrl;

export const isP2PMode = !customServerUrl;
export const SERVER_URL = customServerUrl || 'P2P WebRTC (Tanpa Server / 100% Gratis)';

export const socket = customServerUrl
  ? io(customServerUrl, {
      autoConnect: false,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    })
  : p2pSync;

export const updateServerUrl = (newUrl) => {
  if (!newUrl) return;
  localStorage.setItem('movteg_server_url', newUrl);
  window.location.reload();
};

export const resetToP2P = () => {
  localStorage.removeItem('movteg_server_url');
  window.location.reload();
};
