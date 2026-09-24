import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Default initial video: Open source Big Buck Bunny mp4
const DEFAULT_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

// In-memory room store
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      videoUrl: DEFAULT_VIDEO,
      currentTime: 0,
      isPlaying: false,
      lastUpdated: Date.now(),
      users: new Map(),
    });
  }
  return rooms.get(roomId);
}

function getCalculatedTime(room) {
  if (!room.isPlaying) {
    return room.currentTime;
  }
  const elapsed = (Date.now() - room.lastUpdated) / 1000;
  return room.currentTime + elapsed;
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.send('Movteg Watch Party Server is running! 🍿🎬');
});

io.on('connection', (socket) => {
  let currentRoomId = null;
  let currentUsername = null;

  socket.on('join-room', ({ roomId, username }) => {
    if (!roomId || !username) return;

    currentRoomId = roomId;
    currentUsername = username;
    socket.join(roomId);

    const room = getOrCreateRoom(roomId);
    const isHost = room.users.size === 0;

    room.users.set(socket.id, {
      id: socket.id,
      username,
      isHost,
    });

    // Send initial room state to joining user
    socket.emit('room-state', {
      roomId,
      videoUrl: room.videoUrl,
      isPlaying: room.isPlaying,
      currentTime: getCalculatedTime(room),
      users: Array.from(room.users.values()),
      isHost,
    });

    // Broadcast user joined to everyone else
    socket.to(roomId).emit('user-joined', {
      username,
      users: Array.from(room.users.values()),
    });

    console.log(`[JOIN] ${username} (${socket.id}) joined room ${roomId}`);
  });

  socket.on('video-play', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.isPlaying = true;
    room.currentTime = typeof currentTime === 'number' ? currentTime : room.currentTime;
    room.lastUpdated = Date.now();

    socket.to(roomId).emit('video-play', {
      currentTime: room.currentTime,
      by: currentUsername,
    });
  });

  socket.on('video-pause', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.isPlaying = false;
    room.currentTime = typeof currentTime === 'number' ? currentTime : room.currentTime;
    room.lastUpdated = Date.now();

    socket.to(roomId).emit('video-pause', {
      currentTime: room.currentTime,
      by: currentUsername,
    });
  });

  socket.on('video-seek', ({ roomId, currentTime }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    room.currentTime = currentTime;
    room.lastUpdated = Date.now();

    socket.to(roomId).emit('video-seek', {
      currentTime,
      by: currentUsername,
    });
  });

  socket.on('change-video', ({ roomId, videoUrl }) => {
    const room = rooms.get(roomId);
    if (!room || !videoUrl) return;

    room.videoUrl = videoUrl;
    room.currentTime = 0;
    room.isPlaying = false;
    room.lastUpdated = Date.now();

    io.in(roomId).emit('change-video', {
      videoUrl,
      by: currentUsername,
    });
  });

  socket.on('request-sync', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    socket.emit('sync-update', {
      currentTime: getCalculatedTime(room),
      isPlaying: room.isPlaying,
      videoUrl: room.videoUrl,
    });
  });

  socket.on('send-message', ({ roomId, text }) => {
    if (!roomId || !text || !text.trim()) return;

    const messageData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender: currentUsername || 'Anonim',
      senderId: socket.id,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    io.in(roomId).emit('new-message', messageData);
  });

  socket.on('send-reaction', ({ roomId, emoji }) => {
    if (!roomId || !emoji) return;

    io.in(roomId).emit('new-reaction', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender: currentUsername || 'Pasangan',
      emoji,
    });
  });

  socket.on('call-partner', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('incoming-call', {
      callerName: currentUsername,
      callerId: socket.id
    });
  });

  socket.on('answer-call', ({ roomId, accepted, callerId }) => {
    if (!callerId) return;
    io.to(callerId).emit('call-answered', {
      accepted,
      responderName: currentUsername
    });
  });

  socket.on('end-call', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('call-ended', {
      by: currentUsername
    });
  });

  socket.on('disconnect', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      const user = room.users.get(socket.id);
      room.users.delete(socket.id);

      if (room.users.size === 0) {
        // Clean up empty room after 10 minutes
        setTimeout(() => {
          if (rooms.has(currentRoomId) && rooms.get(currentRoomId).users.size === 0) {
            rooms.delete(currentRoomId);
            console.log(`[CLEANUP] Room ${currentRoomId} deleted`);
          }
        }, 10 * 60 * 1000);
      } else {
        // If host left, assign new host
        if (user?.isHost) {
          const firstUser = room.users.values().next().value;
          if (firstUser) {
            firstUser.isHost = true;
          }
        }
        socket.to(currentRoomId).emit('user-left', {
          username: currentUsername,
          users: Array.from(room.users.values()),
        });
      }
      console.log(`[LEAVE] ${currentUsername} left room ${currentRoomId}`);
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🍿 Movteg server listening on port ${PORT}`);
});
