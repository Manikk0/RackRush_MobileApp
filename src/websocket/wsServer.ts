// src/websocket/wsServer.ts
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
}

class RackRushWS {
  public wss: WebSocketServer;
  public clients: Map<number, Set<ExtendedWebSocket>>;

  constructor(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map(); // userId -> Set of matching WS connections

    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      console.log('New WS connection');
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'auth' && data.userId) {
            const userId = Number(data.userId);
            if (!this.clients.has(userId)) this.clients.set(userId, new Set());
            this.clients.get(userId)!.add(ws);
            ws.userId = userId;
            ws.send(JSON.stringify({ type: 'auth_success' }));
          }
        } catch (e) {
          console.error('WS Message error:', e);
        }
      });

      ws.on('close', () => {
        const userId = ws.userId;
        if (userId && this.clients.has(userId)) {
          this.clients.get(userId)!.delete(ws);
          if (this.clients.get(userId)!.size === 0) this.clients.delete(userId);
        }
      });
    });
  }

  // Send message to a specific user
  sendToUser(userId: number | string, data: any) {
    const userClients = this.clients.get(Number(userId));
    if (userClients) {
      const msg = JSON.stringify(data);
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    }
  }

  // Simple broadcast based on userId property in message
  broadcast(data: any) {
    if (data.userId) {
      this.sendToUser(data.userId, data);
    } else {
      const msg = JSON.stringify(data);
      this.wss.clients.forEach((client: WebSocket) => {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
      });
    }
  }
}

export default RackRushWS;
