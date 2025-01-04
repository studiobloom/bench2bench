import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import GPUBenchmark from '../utils/GPUBenchmark';

// Car component
function Car({ position, color }) {
  const mesh = useRef();

  return (
    <mesh ref={mesh} position={position}>
      <boxGeometry args={[1, 0.5, 2]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

// Track component
function Track() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]}>
      <planeGeometry args={[10, 50]} />
      <meshStandardMaterial color="#333" />
    </mesh>
  );
}

// Race animation component
function RaceAnimation({ seed, progress }) {
  const scene = useRef();
  
  useFrame(({ clock }) => {
    if (scene.current) {
      // Use the seed to create deterministic animations
      const time = clock.getElapsedTime();
      const seedValue = parseInt(seed, 16);
      const wobble = Math.sin(time * 2 + seedValue) * 0.1;
      
      scene.current.rotation.y = wobble;
    }
  });

  return (
    <group ref={scene}>
      <Track />
      {/* Local player's car (red) */}
      <Car position={[1.5, 0, -10 + (progress.local * 20)]} color="#ff0000" />
      {/* Opponent's car (blue) */}
      <Car position={[-1.5, 0, -10 + (progress.opponent * 20)]} color="#0000ff" />
      
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
    </group>
  );
}

// Helper function to format time
function formatRaceTime(seconds) {
  if (!seconds && seconds !== 0) return "00:00:000";
  
  // Convert to milliseconds first
  const totalMs = Math.floor(seconds * 1000);
  
  const minutes = Math.floor(totalMs / (60 * 1000));
  const remainingMs = totalMs % (60 * 1000);
  const secs = Math.floor(remainingMs / 1000);
  const ms = remainingMs % 1000;
  
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
}

// Results display component
function RaceResults({ results, localId, gpuInfo }) {
  const sortedResults = [...results].sort((a, b) => a.raceTime - b.raceTime);
  const winner = sortedResults[0];
  const isWinner = winner.id === localId;

  return (
    <div className="results-overlay">
      <h2>Race Complete!</h2>
      <div className="results-content">
        <p className="winner-text">
          {isWinner ? '🏆 You Won! 🏆' : 'Better luck next time!'}
        </p>
        <div className="results-table">
          {sortedResults.map((result, index) => (
            <div key={result.id} className="result-row">
              <span>{index === 0 ? '1st' : '2nd'} Place:</span>
              <span>{result.id === localId ? gpuInfo.myGPU : 'Opponent'}</span>
              <div className="performance-stats">
                <div className="stats-group">
                  <div className="race-time">Time: {formatRaceTime(result.raceTime)}</div>
                  <div className="fps-value">{result.fps.toFixed(1)} FPS</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main RaceScene component
function RaceScene({ seed, gpuInfo, progress, onMetricUpdate, socket, roomId }) {
  const [benchmark] = useState(() => new GPUBenchmark());
  const [fps, setFps] = useState(0);
  const [raceComplete, setRaceComplete] = useState(false);
  const [raceResults, setRaceResults] = useState(null);
  const raceStartTime = useRef(null);
  const benchmarkStarted = useRef(false);
  const [currentTime, setCurrentTime] = useState(0);
  const lastFpsUpdate = useRef(0);
  const fpsBuffer = useRef([]);

  // Separate effect for the timer
  useEffect(() => {
    let frameId;
    
    function tick() {
      if (raceStartTime.current && !raceComplete) {
        const newTime = (performance.now() - raceStartTime.current) / 1000;
        setCurrentTime(newTime);
      }
      frameId = requestAnimationFrame(tick);
    }

    if (raceStartTime.current) {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [raceComplete]);

  useEffect(() => {
    if (!benchmarkStarted.current && seed) {
      benchmarkStarted.current = true;
      setRaceComplete(false);
      setRaceResults(null);
      raceStartTime.current = performance.now();
      
      // Start the GPU benchmark
      benchmark.runBenchmark(seed, (progress, currentFps) => {
        // Update FPS less frequently using a rolling average
        const now = performance.now();
        if (currentFps) {
          fpsBuffer.current.push(currentFps);
          if (fpsBuffer.current.length > 10) {
            fpsBuffer.current.shift();
          }
          
          if (now - lastFpsUpdate.current > 500) { // Update every 500ms
            const avgFps = fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length;
            setFps(Math.round(avgFps));
            lastFpsUpdate.current = now;
          }
        }
        onMetricUpdate({ progress, fps: currentFps });
      }).then(averageFps => {
        const finalTime = (performance.now() - raceStartTime.current) / 1000;
        setFps(Math.round(averageFps));
        setRaceComplete(true);
        socket.emit('raceComplete', { 
          roomId, 
          fps: averageFps,
          raceTime: Number(finalTime.toFixed(3))
        });
      }).catch(error => {
        console.error('Benchmark error:', error);
      });
    }
  }, [benchmark, seed, onMetricUpdate, socket, roomId]);

  useEffect(() => {
    // Listen for race results
    socket.on('raceResults', (results) => {
      setRaceResults(results);
    });

    return () => {
      socket.off('raceResults');
    };
  }, [socket]);

  return (
    <>
      <Canvas camera={{ position: [0, 5, 5], fov: 75 }}>
        <RaceAnimation seed={seed} progress={progress} />
      </Canvas>
      
      <div className="race-overlay">
        <div className="race-info">
          <div className="gpu-info">Your GPU: {gpuInfo.myGPU}</div>
          <div className="progress-info">
            <div>Your Progress: {Math.round(progress.local * 100)}%</div>
            <div>Opponent Progress: {Math.round(progress.opponent * 100)}%</div>
          </div>
          <div className="time-display">{formatRaceTime(currentTime)}</div>
          {fps > 0 && <div className="fps-value">{Math.round(fps)} FPS</div>}
        </div>
      </div>

      {raceResults && (
        <RaceResults
          results={raceResults}
          localId={socket.id}
          gpuInfo={gpuInfo}
        />
      )}
    </>
  );
}

export default RaceScene; 