# GPU Drag Race

A real-time GPU comparison web application using React, Three.js, and Socket.IO.

## Prerequisites

- Node.js 16.x or higher
- npm 7.x or higher
- A modern browser with WebGL2 support

## Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/gpu-race.git
   cd gpu-race
   ```

2. Create environment files:
   ```bash
   cp .env.example .env
   ```

3. Install dependencies:
   ```bash
   npm run install:all
   ```

4. Start the development servers:
   ```bash
   npm start
   ```

The frontend will be available at http://localhost:3000 and the backend at http://localhost:3001.

## Development

### Frontend
- Built with React and Three.js
- WebGL2 for GPU benchmarking
- Real-time visualization with React Three Fiber

### Backend
- Node.js/Express server
- Socket.IO for real-time communication
- Room-based matchmaking system

## Troubleshooting

If you encounter WebGL errors:
1. Check if your browser supports WebGL2
2. Update your graphics drivers
3. Try a different browser

For connection issues:
1. Verify both servers are running
2. Check your firewall settings
3. Ensure correct ports are available

## License

MIT 