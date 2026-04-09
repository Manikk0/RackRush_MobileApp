// WebSocket vrstva pre realtime eventy
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import jwt from 'jsonwebtoken';
import pool from '../config/db';

interface ExtendedWebSocket extends WebSocket {
  userId?: number;
}

class RackRushWS {
  public wss: WebSocketServer;
  public clients: Map<number, Set<ExtendedWebSocket>>;
  public storeSubscriptions: Map<number, Set<ExtendedWebSocket>>;

  constructor(server: any) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.clients = new Map(); // userId -> otvorene WS spojenia konkretneho usera
    this.storeSubscriptions = new Map(); // storeId -> WS spojenia ktore sleduju vytazenost

    this.wss.on('connection', (ws: ExtendedWebSocket, req: IncomingMessage) => {
      console.log('New WS connection');
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());

          // Bezpecna autentifikacia cez JWT token:
          // klient posle { type: "auth", token: "..." }
          // userId sa berie z tokenu, nie zo vstupu klienta
          if (data.type === 'auth' && data.token) {
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET as string) as any;
            const userId = Number(decoded && decoded.id);
            if (!userId) {
              ws.send(JSON.stringify({ type: 'auth_error', message: 'Neplatny token payload' }));
              return;
            }

            if (!this.clients.has(userId)) {
              this.clients.set(userId, new Set());
            }
            const clientSet = this.clients.get(userId);
            if (clientSet) {
              clientSet.add(ws);
            }
            ws.userId = userId;
            ws.send(JSON.stringify({ type: 'auth_success' }));
            return;
          }

          // Dalsie akcie uz vyzaduju autenticovaneho usera
          if (!ws.userId) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Najprv sa autentifikuj tokenom' }));
            return;
          }

          // Klient si zapne realtime odber vytazenosti konkretnej predajne
          if (data.type === 'store_subscribe' && data.storeId) {
            const storeId = Number(data.storeId);
            if (!this.storeSubscriptions.has(storeId)) {
              this.storeSubscriptions.set(storeId, new Set());
            }
            const storeSet = this.storeSubscriptions.get(storeId);
            if (storeSet) {
              storeSet.add(ws);
            }
            ws.send(JSON.stringify({ type: 'store_subscribed', storeId }));
            return;
          }

          // Klient si vypne realtime odber vytazenosti predajne
          if (data.type === 'store_unsubscribe' && data.storeId) {
            const storeId = Number(data.storeId);
            if (this.storeSubscriptions.has(storeId)) {
              this.storeSubscriptions.get(storeId)!.delete(ws);
            }
            ws.send(JSON.stringify({ type: 'store_unsubscribed', storeId }));
            return;
          }

          // Obojsmerna interakcia:
          // klient posle vstup/vystup z predajne a backend prepocita live_occupancy
          if (data.type === 'store_checkin' && data.storeId && data.action) {
            const storeId = Number(data.storeId);
            const action = String(data.action); // enter | leave
            if (action !== 'enter' && action !== 'leave') {
              ws.send(JSON.stringify({ type: 'store_checkin_error', message: 'action must be enter or leave' }));
              return;
            }

            const storeResult = await pool.query(
              'SELECT id, live_occupancy, max_occupancy FROM stores WHERE id = $1',
              [storeId]
            );
            if (!storeResult.rows.length) {
              ws.send(JSON.stringify({ type: 'store_checkin_error', message: 'Store not found' }));
              return;
            }

            const store = storeResult.rows[0];
            const current = Number(store.live_occupancy || 0);
            const max = Number(store.max_occupancy || 100);
            let next = current;
            if (action === 'enter') next = Math.min(max, current + 1);
            if (action === 'leave') next = Math.max(0, current - 1);

            await pool.query('UPDATE stores SET live_occupancy = $1 WHERE id = $2', [next, storeId]);
            this.broadcastStoreOccupancy(storeId, next, max, action);
            return;
          }

          // Ak prisiel neznamy typ spravy, vratime explicitnu chybu
          ws.send(JSON.stringify({ type: 'ws_error', message: 'Unknown message type' }));
        } catch (e) {
          console.error('WS Message error:', e);
          ws.send(JSON.stringify({ type: 'ws_error', message: 'Invalid WS message format' }));
        }
      });

      ws.on('close', () => {
        const userId = ws.userId;
        if (userId && this.clients.has(userId)) {
          const set = this.clients.get(userId);
          if (set) {
            set.delete(ws);
            if (set.size === 0) {
              this.clients.delete(userId);
            }
          }
        }

        // Upratanie odberov predajni pri zatvoreni spojenia
        this.storeSubscriptions.forEach((set, storeId) => {
          set.delete(ws);
          if (set.size === 0) this.storeSubscriptions.delete(storeId);
        });
      });
    });
  }

  // Broadcast vytazenosti predajne vsetkym odberatelom danej predajne
  broadcastStoreOccupancy(storeId: number, liveOccupancy: number, maxOccupancy: number, action: string) {
    const subscribers = this.storeSubscriptions.get(storeId);
    if (!subscribers) return;
    const payload = JSON.stringify({
      type: 'store_occupancy_update',
      storeId,
      liveOccupancy,
      maxOccupancy,
      action,
    });
    subscribers.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    });
  }

  // Zisti, ci ma user aspon jedno aktivne WS spojenie
  hasActiveConnection(userId: number | string): boolean {
    const userClients = this.clients.get(Number(userId));
    if (!userClients || userClients.size === 0) {
      return false;
    }

    for (const client of userClients) {
      if (client.readyState === WebSocket.OPEN) {
        return true;
      }
    }

    return false;
  }

  // Poslanie spravy konkretnemu userovi
  // Vracia pocet klientov, ktorym sa sprava realne poslala
  sendToUser(userId: number | string, data: any): number {
    const userClients = this.clients.get(Number(userId));
    let sentCount = 0;
    if (userClients) {
      const msg = JSON.stringify(data);
      userClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(msg);
          sentCount++;
        }
      });
    }
    return sentCount;
  }

  // Jednoduchy broadcast: ak je userId, posielame len jemu, inak vsetkym
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
