import { io } from 'socket.io-client';
import { p2pSync } from './p2pSync';

const savedUrl = typeof window !== 'undefined' ? localStorage.getItem('movteg_server_url') : null;
const envUrl = import.meta.env.VITE_SERVER_URL;

let customServerUrl = savedUrl || envUrl;

// If envUrl is an un-deployed onrender.com placeholder and user hasn't explicitly saved it in localStorage, ignore it so P2P works
if (customServerUrl && customServerUrl.includes('onrender.com') && !savedUrl) {
  customServerUrl = null;
}

export const isP2PMode = !customServerUrl;
export const SERVER_URL = customServerUrl || 'P2P WebRTC (Langsung Antar Browser / 100% Gratis)';

export const socket = customServerUrl
  ? io(customServerUrl, {
      autoConnect: false,
      reconnectionAttempts: 5,
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
