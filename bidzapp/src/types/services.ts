export interface NotificationData {
  title: string;
  body: string;
  data?: any;
  sound?: string;
  priority?: 'default' | 'high' | 'max';
}

export interface RideRequestData {
  rideId: number | string;
  rideCode: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  distance: number;
  riderName: string;
  shouldDrawOver?: boolean;
  autoTimeout?: number;
}