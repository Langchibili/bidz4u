const environment = "local"
//const environment = "production" as string


export const EXPO_PUBLIC_PROJECT_ID = "YOUR_PROJECT_ID";

export const SOCKET_EVENTS = {
  CONNECT: 'connect', DISCONNECT: 'disconnect', CONNECTED: 'connected', DISCONNECTED: 'disconnected',
  ORDER: {
    NEW: 'order:new',
    STATUS_UPDATED: 'order:status:updated',
  },
  WAITER_CALL: {
    NEW: 'waiter_call:new',
    ACKNOWLEDGED: 'waiter_call:acknowledged',
  },
  TABLE: {
    STATUS_UPDATED: 'table:status:updated',
  },
  NOTIFICATION: { NEW: 'notification:new', BROADCAST: 'notification:broadcast' },
  SYSTEM: { ANNOUNCEMENT: 'system:announcement' },
  OWNER: { SESSION_REPLACED: 'owner:session-replaced' },
  EMPLOYEE: { SESSION_REPLACED: 'employee:session-replaced' },
  DEVICE: { REGISTER: 'device:register', REGISTER_SUCCESS: 'device:register:success', REGISTER_ERROR: 'device:register:error' },
  CONNECTION: { PING: 'ping', PONG: 'pong', ERROR: 'error', CONNECT_ERROR: 'connect_error' },
};

export const WEBVIEW_EVENTS = {
  ORDER_NEW: 'ORDER_NEW',
  ORDER_STATUS_UPDATED: 'ORDER_STATUS_UPDATED',
  WAITER_CALL_NEW: 'WAITER_CALL_NEW',
  WAITER_CALL_ACKNOWLEDGED: 'WAITER_CALL_ACKNOWLEDGED',
  TABLE_STATUS_UPDATED: 'TABLE_STATUS_UPDATED',
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
  LOG_DATA: 'LOG_DATA',
};

export const CONSTANTS = {
  APP_NAME: 'SmartMenuStaff',
  APP_VERSION: '1.0.0',
  DEVICE_SOCKET_URL: environment === "local" ? "http://10.197.174.23:3008" : "https://devicesocket.yourapp.com",
  MAIN_SOCKET_URL: environment === "local" ? "http://10.197.174.23:4000" : "https://socket.yourapp.com",
  BACKEND_URL: environment === "local" ? "http://10.197.174.23:1357/api" : "https://backend.yourapp.com/api",

  FRONTEND_URLS: {
    owner: environment === "local" ? "http://10.197.174.23:3007" : "https://owner.yourapp.com",
    employee: environment === "local" ? "http://10.197.174.23:3007" : "https://employee.yourapp.com",
  },

  NOTIFICATION: { HEARTBEAT_INTERVAL: 30000 },
  AUDIO: { ORDER_ALERT: 'order_alert', WAITER_CALL: 'waiter_call' },
};

export default { SOCKET_EVENTS, WEBVIEW_EVENTS, NATIVE_EVENTS, CONSTANTS };