import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import VideoPlayer from './components/VideoPlayer';
import ChatPanel from './components/ChatPanel';
import ReactionsOverlay from './components/ReactionsOverlay';
import ChangeVideoModal from './components/ChangeVideoModal';
import JoinRoomModal from './components/JoinRoomModal';
import SettingsModal from './components/SettingsModal';
import ScreenSharePlayer from './components/ScreenSharePlayer';
import UpdateModal from './components/UpdateModal';
import FloatingFaceCam from './components/FloatingFaceCam';
import { socket } from './utils/socket';
import { voiceChat } from './utils/voiceChat';
import { screenShare } from './utils/screenShare';
import { checkForUpdates } from './utils/appVersion';
import { MessageSquare, Video, Film, Heart, Popcorn, Tv } from 'lucide-react';

const DEFAULT_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function App() {
  // Check URL query for room
  const urlParams = new URLSearchParams(window.location.search);
  const initialRoomQuery = urlParams.get('room') || '';

  const [roomId, setRoomId] = useState(initialRoomQuery);
  const [username, setUsername] = useState(() => localStorage.getItem('movteg_username') || '');
  const [isInRoom, setIsInRoom] = useState(false);

  const isMobileWeb = typeof window !== 'undefined' &&
    /Android|iPhone|iPad/i.test(navigator.userAgent) &&
    !(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());

  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [voiceState, setVoiceState] = useState({
    isActive: false,
    isMuted: false,
    isVideoActive: false,
    connectedPeers: 0,
    hasPartnerInVoice: false,
    hasPartnerInCam: false,
    localStream: null,
    remoteStreams: null,
  });
  const [screenShareState, setScreenShareState] = useState({
    isSharing: false,
    hasActiveShare: false,
    stream: null,
    sharerName: '',
    isPresenter: false,
  });

  // Modals
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(true);
  const [isChangeVideoOpen, setIsChangeVideoOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);

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

  // Voice Chat & Screen Share State Listeners
  useEffect(() => {
    voiceChat.onStateChange = (state) => {
      setVoiceState(state);
    };

    screenShare.onStateChange = (state) => {
      setScreenShareState(state);
      if (state.hasActiveShare && state.sharerName && !state.isPresenter) {
        setPartnerToast(`📺 ${state.sharerName} sedang membagikan layar!`);
        setTimeout(() => setPartnerToast(''), 5000);
      }
    };

    voiceChat.onPartnerVoiceStatus = ({ username: partnerName, isActive }) => {
      if (isActive) {
        setPartnerToast(`🎙️ ${partnerName || 'Pasangan'} mengaktifkan obrolan suara!`);
        setTimeout(() => setPartnerToast(''), 5000);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `🎙️ ${partnerName || 'Pasangan'} bergabung ke obrolan suara.`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `🔇 ${partnerName || 'Pasangan'} keluar dari obrolan suara.`,
          },
        ]);
      }
    };

    voiceChat.onPartnerCamStatus = ({ username: partnerName, isVideoActive }) => {
      if (isVideoActive) {
        setPartnerToast(`📹 ${partnerName || 'Pasangan'} menyalakan kamera wajah!`);
        setTimeout(() => setPartnerToast(''), 5000);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `📹 ${partnerName || 'Pasangan'} mengaktifkan kamera wajah (Video Call).`,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `📷 ${partnerName || 'Pasangan'} mematikan kamera wajah.`,
          },
        ]);
      }
    };
  }, []);

  // Automatic update check on app launch (runs after 3 seconds)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const res = await checkForUpdates();
      if (res.hasUpdate) {
        setUpdateInfo(res);
        setIsUpdateModalOpen(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
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

    const handleScreenShareEvent = (data) => {
      if (data.isSharing && data.sharerId !== socket.id) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `📺 ${data.sharerName || 'Pasangan'} mulai membagikan layar film.`,
          },
        ]);
      } else if (!data.isSharing && data.sharerId !== socket.id) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `🛑 Siaran layar telah dihentikan, kembali ke pemutar video URL.`,
          },
        ]);
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('room-state', handleRoomState);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('change-video', handleChangeVideo);
    socket.on('new-message', handleNewMessage);
    socket.on('new-reaction', handleNewReaction);
    socket.on('screen-share-state', handleScreenShareEvent);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('room-state', handleRoomState);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('change-video', handleChangeVideo);
      socket.off('new-message', handleNewMessage);
      socket.off('new-reaction', handleNewReaction);
      socket.off('screen-share-state', handleScreenShareEvent);
    };
  }, [roomId, username, isInRoom]);

  const handleToggleScreenShare = async () => {
    if (screenShareState.isSharing) {
      screenShare.stopScreenShare();
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          isSystem: true,
          text: `🛑 ${username || 'Kamu'} menghentikan siaran layar.`,
        },
      ]);
    } else {
      const success = await screenShare.startScreenShare();
      if (success) {
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            isSystem: true,
            text: `📺 ${username || 'Kamu'} mulai membagikan layar secara langsung.`,
          },
        ]);
      }
    }
  };

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
      {/* Smart Banner: Open in Movteg App for Mobile Browser visitors */}
      {isMobileWeb && (
        <div className="bg-gradient-to-r from-rose-950 via-zinc-900 to-rose-950 border-b border-rose-500/30 px-3 py-2 flex items-center justify-between z-50 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-rose-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-rose-950">
              <Film className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="truncate">
              <span className="font-semibold text-white">Buka di Aplikasi Movteg</span>
              <span className="text-zinc-400 text-[10px] hidden sm:inline ml-1.5">Untuk video call & kontrol film lebih lancar</span>
            </div>
          </div>
          <a
            href={`intent://movteg.vercel.app/?room=${roomId || ''}#Intent;scheme=https;package=com.movteg.app;end`}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1 rounded-lg text-xs flex-shrink-0 ml-2 transition-colors shadow-md shadow-rose-950 cursor-pointer"
          >
            Buka di App
          </a>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        roomId={roomId}
        username={username}
        users={users}
        isConnected={isConnected}
        isVoiceActive={voiceState.isActive}
        isVoiceMuted={voiceState.isMuted}
        hasPartnerInVoice={voiceState.hasPartnerInVoice}
        onToggleVoice={() => voiceChat.toggleVoice()}
        onToggleMute={() => voiceChat.toggleMute()}
        isVideoActive={voiceState.isVideoActive}
        hasPartnerInCam={voiceState.hasPartnerInCam}
        onToggleVideo={() => voiceChat.toggleVideo()}
        isScreenSharing={screenShareState.isSharing}
        hasActiveScreenShare={screenShareState.hasActiveShare}
        onToggleScreenShare={handleToggleScreenShare}
        canShareScreen={screenShare.isSupported()}
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
              {screenShareState.hasActiveShare && screenShareState.stream ? (
                <ScreenSharePlayer
                  stream={screenShareState.stream}
                  isPresenter={screenShareState.isPresenter}
                  sharerName={screenShareState.sharerName}
                  onStopSharing={() => screenShare.stopScreenShare()}
                />
              ) : (
                <VideoPlayer
                  videoUrl={videoUrl}
                  roomId={roomId}
                  socket={socket}
                  onActivity={handleVideoActivity}
                />
              )}
              <ReactionsOverlay reactions={reactions} />
            </div>

            {/* Video Footer info */}
            <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    screenShareState.hasActiveShare ? 'bg-amber-400 animate-ping' : 'bg-rose-500'
                  }`}
                ></span>
                <span className="truncate max-w-xs md:max-w-md">
                  {screenShareState.hasActiveShare
                    ? `🔴 Siaran Layar Langsung: ${screenShareState.sharerName || 'Pasangan'}`
                    : `Sumber: ${videoUrl}`}
                </span>
              </div>
              <span className="hidden sm:inline text-zinc-400 flex-shrink-0">
                {screenShareState.hasActiveShare
                  ? 'Kualitas HD & Audio Sistem Real-Time'
                  : 'Tekan Play/Pause untuk kendali bersama'}
              </span>
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

      {/* Floating Video Call (Face-Cam) */}
      <FloatingFaceCam
        localStream={voiceState.localStream}
        remoteStreams={voiceState.remoteStreams}
        isVideoActive={voiceState.isVideoActive}
        isVoiceActive={voiceState.isActive}
        isMuted={voiceState.isMuted}
        hasPartnerInCam={voiceState.hasPartnerInCam}
        hasPartnerInVoice={voiceState.hasPartnerInVoice}
        partnerName={users.find((u) => u.username && u.username !== username)?.username}
        onToggleVideo={() => voiceChat.toggleVideo()}
        onToggleVoice={() => voiceChat.toggleVoice()}
        onToggleMute={() => voiceChat.toggleMute()}
        onFlipCamera={() => voiceChat.flipCamera()}
      />

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
        onOpenUpdateModal={(info) => {
          setUpdateInfo(info);
          setIsUpdateModalOpen(true);
        }}
      />

      <UpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
      />
    </div>
  );
}
