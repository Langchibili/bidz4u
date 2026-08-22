// sockets/index.js

require('dotenv').config();
const { createServer } = require('http');
const { Server } = require('socket.io');
const logger = require('./logger');
 
// ==================== ENVIRONMENT CONFIGURATION ====================
const environment = process.env.NODE_ENV || 'local';
const PORT = Number(process.env.SOCKET_PORT) || 3015;
const STRAPI_SOCKET_SECRET = process.env.STRAPI_SOCKET_SECRET || '';
 
function resolveClientUrls() {
  const key = environment === 'production'
    ? 'CLIENT_URLS_PRODUCTION'
    : environment === 'test' || environment === 'staging' || environment === 'development'
      ? 'CLIENT_URLS_TEST'
      : 'CLIENT_URLS_LOCAL';
  const raw = process.env[key] || '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
const allowedOrigins = resolveClientUrls();
 
// ==================== HTTP & SOCKET.IO SERVER SETUP ====================
const httpServer = createServer();
 
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins.length ? allowedOrigins : '*', methods: ['GET', 'POST'], credentials: true },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
});
 
const mainNsp = io.of('/main-sockets');     // browser frontend
const deviceNsp = io.of('/device-sockets'); // RN WebView devices
 
// ==================== CONNECTION TRACKING ====================
const connections = {
  bidders: new Map(),   // userId -> Set<socket.id>  (can have multiple tabs/devices)
  sellers: new Map(),   // userId -> Set<socket.id>
  admins: new Map(),    // adminId -> Set<socket.id>
  sockets: new Map(),   // socket.id -> { nsp, type, id, auctionItemId }
};
 
function addConnection(map, key, socketId) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(socketId);
}
function removeConnection(map, key, socketId) {
  const set = map.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) map.delete(key);
}
 
// ==================== HELPERS ====================
 
function emitToRoom(nsp, room, event, data) {
  nsp.to(room).emit(event, data);
  logger.info(`Emitted '${event}' to room '${room}'`);
}
 
// Emits to a specific logged-in user across BOTH namespaces (web + device),
// via their personal room `user:${userId}`.
function emitToUser(userId, event, data) {
  const room = `user:${userId}`;
  mainNsp.to(room).emit(event, data);
  deviceNsp.to(room).emit(event, data);
  logger.info(`Emitted '${event}' to user ${userId} (web + device)`);
}
 
// Emits to everyone watching a specific auction item, across both namespaces.
function emitToAuction(auctionItemId, event, data) {
  const room = `auction:${auctionItemId}`;
  mainNsp.to(room).emit(event, data);
  deviceNsp.to(room).emit(event, data);
  logger.info(`Emitted '${event}' to auction ${auctionItemId} (web + device)`);
}
 
function broadcastAll(event, data) {
  mainNsp.emit(event, data);
  deviceNsp.emit(event, data);
}
 
// ==================== PER-NAMESPACE CONNECTION HANDLER ====================
 
function bindNamespace(nsp, label) {
  nsp.on('connection', (socket) => {
    const { auctionItemId, userId, userType, isStrapiSystem, strapiSecret } = socket.handshake.query;
 
    // ── Strapi system connection (only allowed on /main-sockets) ────────────
    if (isStrapiSystem === 'true') {
      if (label !== 'main') {
        socket.disconnect(true);
        return;
      }
      if (!STRAPI_SOCKET_SECRET || strapiSecret !== STRAPI_SOCKET_SECRET) {
        logger.warn(`[${label}] Rejected Strapi system connection — bad/missing secret`, { socketId: socket.id });
        socket.disconnect(true);
        return;
      }
      logger.info(`[${label}] Strapi system client connected`, { socketId: socket.id });
      bindStrapiRelay(socket);
      return;
    }
 
    logger.info(`[${label}] client connected`, { socketId: socket.id, auctionItemId: auctionItemId || null, userId: userId || null });
 
    // Auto-join the auction room if the client connected with ?auctionItemId=
    if (auctionItemId) socket.join(`auction:${auctionItemId}`);
 
    // Auto-join personal room if the client connected with ?userId=&userType=
    if (userId) {
      socket.join(`user:${userId}`);
      const map = userType === 'seller' ? connections.sellers : userType === 'admin' ? connections.admins : connections.bidders;
      addConnection(map, userId, socket.id);
      connections.sockets.set(socket.id, { nsp: label, type: userType || 'bidder', id: userId, auctionItemId: auctionItemId || null });
    }
 
    socket.emit(`${label}:connected`, { socketId: socket.id });
 
    // ── Client-initiated room management (switching between auction pages) ──
    socket.on('auction:watch', ({ auctionItemId: newId }) => {
      if (!newId) return;
      socket.join(`auction:${newId}`);
      logger.info(`[${label}] socket ${socket.id} watching auction ${newId}`);
    });
 
    socket.on('auction:unwatch', ({ auctionItemId: oldId }) => {
      if (!oldId) return;
      socket.leave(`auction:${oldId}`);
    });
 
    socket.on('ping', () => socket.emit('pong', { timestamp: Date.now() }));
 
    socket.on('disconnect', (reason) => {
      logger.info(`[${label}] client disconnected`, { socketId: socket.id, reason });
      const info = connections.sockets.get(socket.id);
      if (info) {
        const map = info.type === 'seller' ? connections.sellers : info.type === 'admin' ? connections.admins : connections.bidders;
        removeConnection(map, info.id, socket.id);
        connections.sockets.delete(socket.id);
      }
    });
 
    socket.on('error', (error) => {
      logger.error(`[${label}] socket error`, { socketId: socket.id, error: error?.message });
    });
  });
}
 
// ── Events Strapi is allowed to push through the system connection ──────────
// Whitelisted so a compromised secret can't be used to emit arbitrary events.
const STRAPI_ALLOWED_EVENTS = new Set([
  'bid:placed',
  'auction:extended',
  'auction:closed',
  'bid:forfeited',
  'payment:success',
  'payment:failed',
  'device:haptic',
  'notification:new',
  'notification:broadcast',
  'admin:announcement',
]);
 
function bindStrapiRelay(strapiSocket) {
  strapiSocket.onAny((event, payload) => {
    if (!STRAPI_ALLOWED_EVENTS.has(event)) {
      logger.warn(`[strapi-relay] Rejected non-whitelisted event '${event}'`);
      return;
    }
 
    // Auction-scoped events go to the auction room on both namespaces.
    if (payload?.auctionItemId) {
      emitToAuction(payload.auctionItemId, event, payload);
      return;
    }
 
    // User-scoped events go to that user's personal room on both namespaces.
    if (payload?.userId) {
      emitToUser(payload.userId, event, payload);
      return;
    }
 
    // Otherwise, broadcast to everyone (system announcements, global notices).
    broadcastAll(event, payload);
  });
 
  strapiSocket.on('disconnect', (reason) => {
    logger.info('[strapi-relay] Strapi system client disconnected', { reason });
  });
}
 
bindNamespace(mainNsp, 'main');
bindNamespace(deviceNsp, 'device');
 
// ==================== HTTP HEALTH CHECK ====================
httpServer.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      environment,
      connections: {
        bidders: connections.bidders.size,
        sellers: connections.sellers.size,
        admins: connections.admins.size,
        totalSockets: connections.sockets.size,
      },
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      connections: {
        bidders: connections.bidders.size,
        sellers: connections.sellers.size,
        admins: connections.admins.size,
        totalSockets: connections.sockets.size,
      },
      mainNamespaceClients: mainNsp.sockets.size,
      deviceNamespaceClients: deviceNsp.sockets.size,
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  res.writeHead(404);
  res.end('Not Found');
});
 
// ==================== SERVER START ====================
httpServer.listen(PORT, () => {
  console.log(`🚀 bidz4u Socket Server started`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🌍 Environment: ${environment}`);
  console.log(`🔐 Allowed origins: ${allowedOrigins.length ? allowedOrigins.join(', ') : '*'}`);
  console.log(`🧩 Namespaces: /main-sockets, /device-sockets`);
});
 
// ==================== GRACEFUL SHUTDOWN ====================
function shutdown(signal) {
  console.log(`${signal} received, closing server gracefully...`);
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
 
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});