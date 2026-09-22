export interface WebViewMessage {
  type: string;
  requestId?: string;
  payload?: any;
}

export interface NativeResponse {
  type: string;
  requestId?: string;
  payload?: any;
  error?: string;
}

export type MessageType =
  | 'INITIALIZE_SERVICES'
  | 'REQUEST_PERMISSION'
  | 'CHECK_PERMISSION'
  | 'GET_CURRENT_LOCATION'
  | 'START_LOCATION_TRACKING'
  | 'STOP_LOCATION_TRACKING'
  | 'SHOW_NOTIFICATION'
  | 'PLAY_AUDIO'
  | 'GO_ONLINE'
  | 'GO_OFFLINE'
  | 'NAVIGATE_TO'
  | 'LOCATION_UPDATE'
  | 'RIDE_REQUEST'
  | 'NOTIFICATION_RECEIVED'
  | 'SOCKET_CONNECTED'
  | 'SOCKET_DISCONNECTED'
  | 'APP_RESUMED';