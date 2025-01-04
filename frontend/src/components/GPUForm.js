import React, { useState } from 'react';

function GPUForm({ onSubmit, room, setRoom, isConnected }) {
  const [gpuName, setGpuName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (gpuName.trim() && room.trim()) {
      onSubmit(gpuName.trim());
    }
  };

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="gpu">Your GPU Model:</label>
          <input
            type="text"
            id="gpu"
            value={gpuName}
            onChange={(e) => setGpuName(e.target.value)}
            placeholder="e.g., RTX 3080"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="room">Room ID:</label>
          <input
            type="text"
            id="room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter room ID"
            required
          />
        </div>

        <button type="submit" disabled={!isConnected}>
          Join Race
        </button>
      </form>

      {!isConnected && (
        <p className="status">
          Connecting to server...
        </p>
      )}
    </div>
  );
}

export default GPUForm; 