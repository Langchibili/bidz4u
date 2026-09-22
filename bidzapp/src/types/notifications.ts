export type NotificationType =
  | 'ride_request'
  | 'ride_started'
  | 'ride_completed'
  | 'message'
  | 'payment_received'
  | 'reconnect'
  | 'wake_up';

export interface NotificationPayload {
  type: NotificationType;
  rideId?: number | string;
  rideCode?: string;
  conversationId?: number | string;
  action?: string;
  [key: string]: any;
}