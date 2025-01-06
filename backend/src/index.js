const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

const app = express();
const server = http.createServer(app);
const corsOptions = {
  origin: CORS_ORIGIN,
  methods: ["GET", "POST"],
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// Basic health check route
app.get('/', (req, res) => {
  res.json({ status: 'GPU Race Server Running' });
});

// Store active rooms and their participants
const rooms = new Map();
// Store race results and ready states
const raceStates = new Map();

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Add error handling to existing events
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  // Handle room joining
  socket.on('joinRoom', (roomId) => {
    console.log(`User ${socket.id} joining room ${roomId}`);
    
    // Create room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
      raceStates.set(roomId, {
        results: new Map(),
        readyForNextRace: new Set()
      });
    }
    
    const room = rooms.get(roomId);
    
    // Check if room is full
    if (room.size >= 2) {
      socket.emit('roomFull');
      return;
    }
    
    // Join the room
    socket.join(roomId);
    room.add(socket.id);
    
    // If room is now full, start the race
    if (room.size === 2) {
      // Generate random seed for synchronized benchmarking
      const randomSeed = crypto.randomBytes(16).toString('hex');
      
      io.to(roomId).emit('startRace', {
        seed: randomSeed,
        participants: Array.from(room)
      });
    }
  });

  // Handle race completion
  socket.on('raceComplete', ({ roomId, fps, raceTime }) => {
    const raceState = raceStates.get(roomId);
    if (raceState) {
      raceState.results.set(socket.id, { fps, raceTime });
      
      // If both players have finished, emit results
      if (raceState.results.size === 2) {
        const results = Array.from(raceState.results.entries()).map(([id, data]) => ({
          id,
          fps: data.fps,
          raceTime: data.raceTime
        }));
        io.to(roomId).emit('raceResults', results);
      }
    }
  });

  // Handle ready for next race
  socket.on('readyForNextRace', (roomId) => {
    const raceState = raceStates.get(roomId);
    if (raceState) {
      raceState.readyForNextRace.add(socket.id);
      
      // If both players are ready, start new race
      if (raceState.readyForNextRace.size === 2) {
        const randomSeed = crypto.randomBytes(16).toString('hex');
        raceState.results.clear();
        raceState.readyForNextRace.clear();
        
        io.to(roomId).emit('startRace', {
          seed: randomSeed,
          participants: Array.from(rooms.get(roomId))
        });
      } else {
        // Notify others that this player is ready
        socket.to(roomId).emit('opponentReady');
      }
    }
  });

  // Handle WebRTC signaling
  socket.on('signal', ({ target, signal }) => {
    io.to(target).emit('signal', {
      from: socket.id,
      signal
    });
  });

  // Handle GPU metrics updates
  socket.on('metricUpdate', ({ roomId, metrics }) => {
    socket.to(roomId).emit('opponentMetrics', {
      from: socket.id,
      metrics
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove user from all rooms and race states
    rooms.forEach((participants, roomId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        if (participants.size === 0) {
          rooms.delete(roomId);
          raceStates.delete(roomId);
        } else {
          // Notify remaining participant
          io.to(roomId).emit('opponentLeft');
        }
      }
    });
  });
});

// Add graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
}); 