export interface LocationData {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

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