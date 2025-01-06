import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import RaceScene from './components/RaceScene';
import GPUForm from './components/GPUForm';

const SOCKET_URL = process.env.NODE_ENV === 'production'
  ? 'https://bench2bench.onrender.com'  // Your Render URL
  : 'http://localhost:3001';

const socket = io(SOCKET_URL, {
  withCredentials: false,
  reconnectionAttempts: 5,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

function App() {
  const [room, setRoom] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const [seed, setSeed] = useState(null);
  const [gpuInfo, setGpuInfo] = useState({ myGPU: '', opponentGPU: '' });
  const [status, setStatus] = useState('Waiting to connect...');
  const [progress, setProgress] = useState({ local: 0, opponent: 0 });

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      setStatus('Connected to server');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setStatus('Disconnected from server');
    });

    socket.on('roomFull', () => {
      setStatus('Room is full, please try another room');
    });

    socket.on('startRace', ({ seed: raceSeed, participants }) => {
      setRaceStarted(true);
      setSeed(raceSeed);
      setProgress({ local: 0, opponent: 0 });
      setStatus('Race started!');
    });

    socket.on('opponentMetrics', ({ metrics }) => {
      setProgress(prev => ({
        ...prev,
        opponent: metrics.progress
      }));
    });

    socket.on('opponentLeft', () => {
      setStatus('Opponent left the race');
      setRaceStarted(false);
      setProgress({ local: 0, opponent: 0 });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('roomFull');
      socket.off('startRace');
      socket.off('opponentMetrics');
      socket.off('opponentLeft');
    };
  }, []);

  const handleJoinRoom = (gpuName) => {
    if (!room) {
      setStatus('Please enter a room ID');
      return;
    }

    setGpuInfo(prev => ({ ...prev, myGPU: gpuName }));
    socket.emit('joinRoom', room);
    setStatus(`Joining room ${room}...`);
  };

  const handleMetricUpdate = (metrics) => {
    setProgress(prev => ({
      ...prev,
      local: metrics.progress
    }));
    socket.emit('metricUpdate', {
      roomId: room,
      metrics
    });
  };

  return (
    <div className="app">
      <h1>GPU Drag Race</h1>
      
      {!raceStarted ? (
        <GPUForm 
          onSubmit={handleJoinRoom}
          room={room}
          setRoom={setRoom}
          isConnected={isConnected}
        />
      ) : (
        <div className="race-container">
          <RaceScene
            seed={seed}
            gpuInfo={gpuInfo}
            progress={progress}
            onMetricUpdate={handleMetricUpdate}
            socket={socket}
            roomId={room}
          />
        </div>
      )}

      <div className="status">
        Status: {status}
      </div>
    </div>
  );
}

export default App; 