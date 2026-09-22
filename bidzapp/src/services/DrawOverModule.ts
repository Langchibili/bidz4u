// OkraApp\src\services\DrawOverModule.ts
import DrawOverNativeModule from '../../modules/expo-draw-over';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

interface DrawOverData {
  rideId: number | string;
  rideCode: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  distance: number;
  riderName: string;
  autoTimeout: number;
}

class DrawOverModule {
  private isModuleAvailable(): boolean {
    if (Platform.OS !== 'android') {
      return false;
    }

    if (!DrawOverNativeModule) {
      logger.error('❌ DrawOverNativeModule not available');
      return false;
    }

    return true;
  }

  private validateData(data: DrawOverData): boolean {
    const required = ['rideId', 'rideCode', 'pickupAddress', 'dropoffAddress', 'estimatedFare', 'distance', 'riderName', 'autoTimeout'];
    
    for (const field of required) {
      if (data[field as keyof DrawOverData] === undefined || data[field as keyof DrawOverData] === null) {
        logger.error(`❌ Missing field: ${field}`);
        return false;
      }
    }
    return true;
  }

  async show(data: DrawOverData): Promise<void> {
    if (Platform.OS !== 'android') {
      logger.warn('⚠️ Draw-over only on Android');
      return;
    }

    try {
      logger.info('📱 Showing draw-over...');
      logger.info('📊 Data:', JSON.stringify(data, null, 2));

      if (!this.isModuleAvailable()) {
        logger.error('❌ Module not available');
        return;
      }

      if (!this.validateData(data)) {
        logger.error('❌ Invalid data');
        return;
      }

      logger.info('✅ Validated, calling native...');
      await DrawOverNativeModule.showOverlay(data);
      logger.info('✅ Overlay shown!');
    } catch (error) {
      logger.error('❌ Error:', error);
    }
  }

  async hide(): Promise<void> {
    if (!this.isModuleAvailable()) return;
    try {
      await DrawOverNativeModule.hideOverlay();
      logger.info('✅ Hidden');
    } catch (error) {
      logger.error('❌ Hide error:', error);
    }
  }

  async isShowing(): Promise<boolean> {
    if (!this.isModuleAvailable()) return false;
    try {
      return await DrawOverNativeModule.isOverlayShowing();
    } catch (error) {
      logger.error('❌ Status error:', error);
      return false;
    }
  }
}

export default new DrawOverModule();