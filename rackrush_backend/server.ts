// server.js – Entry point
require('dotenv').config();
import http from 'http';
import app from './src/app';
import RackRushWS from './src/websocket/wsServer';

const PORT = parseInt(process.env.PORT as string) || 3000;

const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new RackRushWS(server);

// Share wsServer instance with the app (used in routes for notifications)
app.set('wss', wsServer);

server.listen(PORT, '0.0.0.0', () => { // '0.0.0.0' explicitly listens on ALL network interfaces
  console.log(`
  RackRush Backend running!
  ----------------------------
  Local:    http://localhost:${PORT}
  Remote:   http://YOUR_PC_IP:${PORT}
  WS Server: ws://YOUR_PC_IP:${PORT}/ws
  Mode:     ${process.env.NODE_ENV || 'development'}
  ----------------------------
  `);
});