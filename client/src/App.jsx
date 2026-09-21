import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import ChatPanel from './components/ChatPanel';
import ReactionsOverlay from './components/ReactionsOverlay';
import ChangeVideoModal from './components/ChangeVideoModal';
import JoinRoomModal from './components/JoinRoomModal';
import SettingsModal from './components/SettingsModal';
import { socket } from './utils/socket';
import { voiceChat } from './utils/voiceChat';
import { MessageSquare, Video, Film, Heart, Popcorn } from 'lucide-react';

const DEFAULT_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function App() {
  // Check URL query for room
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoomQuery = urlParams.get('room') || '';

  const [roomId, setRoomId] = useState(initialRoomQuery);
  const [username, setUsername] = useState(() => localStorage.getItem('movteg_username') || '');
  const [isInRoom, setIsInRoom] = useState(false);

  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [voiceState, setVoiceState] = useState({ isActive: false, isMuted: false, connectedPeers: 0 });

  // Modals
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(true);
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Mobile layout tab
  const [partnerToast, setPartnerToast] = useState('');

  // Join Room Handler
  const handleJoin = (targetRoomId, enteredName, isGuest = false) => {
    setRoomId(targetRoomId);
    setUsername(enteredName);
    setIsJoinModalOpen(false);
    setIsInRoom(true);

    // Update URL query param without reload
    const newUrl = `${window.location.pathname}?room=${targetRoomId}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);

    // Connect socket if disconnected
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('join-room', {
      roomId: targetRoomId,
      username: enteredName,
      isGuest,
    });
  };

  // Voice Chat State Listener
  useEffect(() => {
    voiceChat.onStateChange = (state) => {
      setVoiceState(state);
    };
  }, []);

  // Socket Connection and Event Listeners
  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      if (roomId && username && isInRoom) {
        socket.emit('join-room', { roomId, username });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleRoomState = (state) => {
      if (state.videoUrl) setVideoUrl(state.videoUrl);
      if (state.users) setUsers(state.users);
    };

    const handleUserJoined = ({ username: joinedUser, users: updatedUsers }) => {
      setUsers(updatedUsers || []);
      setPartnerToast(`🎉 ${joinedUser} bergabung ke ruangan bioskop!`);
      setTimeout(() => setPartnerToast(''), 5000);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          isSystem: true,
          text: `🎉 ${joinedUser} bergabung ke ruangan bioskop!`,
        },
      ]);
    };

    const handleUserLeft = ({ username: leftUser, users: updatedUsers }) => {
      setUsers(updatedUsers || []);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          isSystem: true,
          text: `👋 ${leftUser} keluar dari ruangan.`,
        },
      ]);
    };

    const handleChangeVideo = ({ videoUrl: newUrl, by }) => {
      setVideoUrl(newUrl);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          isSystem: true,
          text: `🎬 ${by || 'Pasangan'} mengganti film ke video baru.`,
        },
      ]);
    };

    const handleNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const handleNewReaction = (reaction) => {
      setReactions((prev) => [...prev, reaction]);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room-state', handleRoomState);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('change-video', handleChangeVideo);
    socket.on('new-message', handleNewMessage);
    socket.on('new-reaction', handleNewReaction);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room-state', handleRoomState);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('change-video', handleChangeVideo);
      socket.off('new-message', handleNewMessage);
      socket.off('new-reaction', handleNewReaction);
    };
  }, [roomId, username, isInRoom]);

  const handleSelectNewVideo = (newUrl) => {
    setVideoUrl(newUrl);
    if (socket && roomId) {
      socket.emit('change-video', {
        roomId,
        videoUrl: newUrl,
      });
    }
  };

  const handleManualSync = () => {
    if (socket && roomId) {
      socket.emit('request-sync', { roomId });
    }
  };

  const handleVideoActivity = useCallback((activityText) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `sys-${Date.now()}`,
        isSystem: true,
        text: `⚡ ${activityText}`,
      },
    ]);
  }, []);

  return (
    <div className="h-[100dvh] overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        username={username}
        users={users}
        isConnected={isConnected}
        isVoiceActive={voiceState.isActive}
        isVoiceMuted={voiceState.isMuted}
        onToggleVoice={() => voiceChat.toggleVoice()}
        onToggleMute={() => voiceChat.toggleMute()}
        onOpenChangeVideo={() => setIsChangeVideoOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onManualSync={handleManualSync}
      />

      {/* Floating Partner Join Notification */}
      {partnerToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-600/95 text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold animate-fade-in border border-emerald-400/40 backdrop-blur-md">
          <Popcorn className="w-4 h-4 text-amber-300 animate-bounce" />
          <span>{partnerToast}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-3 md:p-6 flex flex-col max-w-7xl w-full mx-auto min-h-0">
        {/* Layout: Stacked on Mobile, Grid on Desktop */}
        <div className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6 min-h-0">
          {/* Top/Left: Video Player & Reactions */}
          <div className="lg:col-span-2 relative flex flex-col w-full flex-none lg:flex-auto min-h-0">
            <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 lg:h-full flex-none bg-black rounded-xl overflow-hidden shadow-xl border border-zinc-800/80">
              <VideoPlayer
                videoUrl={videoUrl}
                roomId={roomId}
                socket={socket}
                onActivity={handleVideoActivity}
              />
              <ReactionsOverlay reactions={reactions} />
            </div>

            {/* Video Footer info */}
            <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="truncate max-w-xs md:max-w-md">
                  Sumber: {videoUrl}
                </span>
              </div>
              <span className="hidden sm:inline">Tekan Play/Pause untuk kendali bersama</span>
            </div>
          </div>

          {/* Bottom/Right: Real-time Chat Panel */}
          <div className="flex-1 min-h-0 lg:h-full flex flex-col">
            <ChatPanel
              roomId={roomId}
              username={username}
              socket={socket}
              messages={messages}
              users={users}
              onSendReaction={(emoji) => {
                setReactions((prev) => [
                  ...prev,
                  { id: `${Date.now()}`, sender: username, emoji },
                ]);
              }}
            />
          </div>
        </div>
      </main>

      {/* Modals */}
      <JoinRoomModal
        isOpen={isJoinModalOpen}
        initialRoomId={initialRoomQuery}
        onJoin={handleJoin}
      />

      <ChangeVideoModal
        isOpen={isChangeVideoOpen}
        currentUrl={videoUrl}
        onClose={() => setIsChangeVideoOpen(false)}
        onSelectVideo={handleSelectNewVideo}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        isConnected={isConnected}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
