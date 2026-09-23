const environment = "local"
//const environment = "production" as string


export const EXPO_PUBLIC_PROJECT_ID = "YOUR_PROJECT_ID";

export const SOCKET_EVENTS = {
  CONNECT: 'connect', DISCONNECT: 'disconnect', CONNECTED: 'connected', DISCONNECTED: 'disconnected',
  AUCTION: {
    BID_PLACED: 'bid:placed',
    EXTENDED: 'auction:extended',
    CLOSED: 'auction:closed',
    FORFEITED: 'bid:forfeited',
  },
  PAYMENT: {
    REQUIRED: 'payment:required',
    SUCCESS: 'payment:success',
    FAILED: 'payment:failed',
  },
  NOTIFICATION: { NEW: 'notification:new', BROADCAST: 'notification:broadcast' },
  SYSTEM: { ANNOUNCEMENT: 'system:announcement' },
  DEVICE: {
    REGISTER: 'device:register', REGISTER_SUCCESS: 'device:register:success', REGISTER_ERROR: 'device:register:error',
    SESSION_REPLACED: 'device:session-replaced', HEARTBEAT: 'device:heartbeat',
  },
  CONNECTION: { PING: 'ping', PONG: 'pong', ERROR: 'error', CONNECT_ERROR: 'connect_error' },
};

export const WEBVIEW_EVENTS = {
  BID_PLACED: 'BID_PLACED',
  AUCTION_EXTENDED: 'AUCTION_EXTENDED',
  AUCTION_CLOSED: 'AUCTION_CLOSED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  NOTIFICATION_NEW: 'NOTIFICATION_NEW',
  NOTIFICATION_BROADCAST: 'NOTIFICATION_BROADCAST',
  NOTIFICATION_RECEIVED: 'NOTIFICATION_RECEIVED',
  SOCKET_CONNECTED: 'SOCKET_CONNECTED',
  SOCKET_DISCONNECTED: 'SOCKET_DISCONNECTED',
  SOCKET_ERROR: 'SOCKET_ERROR',
  APP_RESUMED: 'APP_RESUMED',
  SESSION_REPLACED: 'SESSION_REPLACED',
};

export const NATIVE_EVENTS = {
  INITIALIZE_SERVICES: 'INITIALIZE_SERVICES',
  REQUEST_PERMISSION: 'REQUEST_PERMISSION',
  CHECK_PERMISSION: 'CHECK_PERMISSION',
  GET_CURRENT_LOCATION: 'GET_CURRENT_LOCATION',
  SHOW_NOTIFICATION: 'SHOW_NOTIFICATION',
  PLAY_AUDIO: 'PLAY_AUDIO',
  RECONNECT_SOCKET: 'RECONNECT_SOCKET',
  DISCONNECT_SOCKET: 'DISCONNECT_SOCKET',
  LOG_DATA: 'LOG_DATA',
};

export const CONSTANTS = {
  APP_NAME: 'Bidz4u',
  APP_VERSION: '1.0.0',
  DEVICE_SOCKET_URL: environment === "local" ? "http://10.197.174.23:3015/device-sockets" : "https://socket.bidz4u.com/device-sockets",
  MAIN_SOCKET_URL: environment === "local" ? "http://10.197.174.23:3015/main-sockets" : "https://socket.bidz4u.com/main-sockets",
  BACKEND_URL: environment === "local" ? "http://10.197.174.23:1343/api" : "https://api.bidz4u.com/api",

  FRONTEND_URLS: {
    bidder: environment === "local" ? "http://10.197.174.23:3000" : "https://bidz4u.com",
  },

  NOTIFICATION: { HEARTBEAT_INTERVAL: 30000 },
  AUDIO: { BID_ALERT: 'bid_alert' },
};

export default { SOCKET_EVENTS, WEBVIEW_EVENTS, NATIVE_EVENTS, CONSTANTS };