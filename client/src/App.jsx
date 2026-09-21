import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import ChatPanel from './components/ChatPanel';
import ReactionsOverlay from './components/ReactionsOverlay';
import ChangeVideoModal from './components/ChangeVideoModal';
import JoinRoomModal from './components/JoinRoomModal';
import SettingsModal from './components/SettingsModal';
import { socket } from './utils/socket';
import { MessageSquare, Video, Film, Heart } from 'lucide-react';

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

  // Modals
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(true);
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Mobile layout tab
  const [mobileTab, setMobileTab] = useState('video'); // 'video' | 'chat'

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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        username={username}
        users={users}
        isConnected={isConnected}
        onOpenChangeVideo={() => setIsChangeVideoOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onManualSync={handleManualSync}
      />

      {/* Main Content Area */}
      <main className="flex-1 p-3 md:p-6 flex flex-col max-w-7xl w-full mx-auto">
        {/* Mobile View Toggle */}
        <div className="lg:hidden flex mb-3 bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setMobileTab('video')}
            className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'video' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            Layar Film
          </button>
          <button
            onClick={() => setMobileTab('chat')}
            className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-1.5 transition-all ${
              mobileTab === 'chat' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Obrolan ({messages.length})
          </button>
        </div>

        {/* Grid Layout: Video Player + Chat */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 min-h-[500px]">
          {/* Left / Center: Video Player & Reactions */}
          <div
            className={`lg:col-span-2 relative flex flex-col ${
              mobileTab === 'chat' ? 'hidden lg:flex' : 'flex'
            }`}
          >
            <div className="relative w-full h-[55vh] md:h-[72vh] flex-1">
              <VideoPlayer
                videoUrl={videoUrl}
                roomId={roomId}
                socket={socket}
                onActivity={handleVideoActivity}
              />
              <ReactionsOverlay reactions={reactions} />
            </div>

            {/* Video Footer info */}
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span className="truncate max-w-xs md:max-w-md">
                  Sumber: {videoUrl}
                </span>
              </div>
              <span className="hidden sm:inline">Tekan Play/Pause untuk kendali bersama</span>
            </div>
          </div>

          {/* Right: Real-time Chat Panel */}
          <div
            className={`h-[70vh] lg:h-[72vh] ${
              mobileTab === 'video' ? 'hidden lg:flex flex-col' : 'flex flex-col'
            }`}
          >
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
