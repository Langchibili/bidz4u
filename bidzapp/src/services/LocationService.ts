import * as Location from 'expo-location';
import DeviceSocketService from './DeviceSocketService';
import { logger } from '../utils/logger';

class LocationService {
  private deviceId: string | null = null;

  setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
  }

  async getCurrentLocation(): Promise<Location.LocationObject | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') { logger.error('Location permission not granted'); return null; }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });

      if (this.deviceId && DeviceSocketService.isConnected()) {
        await DeviceSocketService.emit('device:location:update', {
          deviceId: this.deviceId,
          location: {
            lat: location.coords.latitude, lng: location.coords.longitude,
            accuracy: location.coords.accuracy, heading: location.coords.heading,
          },
          timestamp: location.timestamp,
        });
      }
      return location;
    } catch (error) {
      logger.error('Error getting current location:', error);
      return null;
    }
  }
}

export default new LocationService();