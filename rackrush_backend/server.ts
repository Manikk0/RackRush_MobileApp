// server.ts - hlavny vstup backendu
require('dotenv').config();
import http from 'http';
import app from './src/app';
import RackRushWS from './src/websocket/wsServer';

const PORT = parseInt(process.env.PORT as string) || 3000;

const server = http.createServer(app);

// Inicializacia WebSocket servera
const wsServer = new RackRushWS(server);

// Spristupnenie WS instancie v route moduloch (napr. notifikacie)
app.set('wss', wsServer);

server.listen(PORT, '0.0.0.0', () => { // Pocuva na vsetkych sietovych rozhraniach
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