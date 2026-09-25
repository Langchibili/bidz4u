import DeviceSocketService from './DeviceSocketService';
import NotificationService from './NotificationService';
import AudioService from './AudioService';
import { logger } from '../utils/logger';
import DrawOverNativeModule from 'expo-draw-over';

interface ServiceConfig { deviceId: string; userId: string | number; frontendName: 'bidder' | 'seller'; socketServerUrl: string; }

class BackgroundService {
  private isRunning = false;
  private runningUserId: string | number | null = null;

  async start(config: ServiceConfig): Promise<boolean> {
    if (this.isRunning && String(this.runningUserId) === String(config.userId)) return true;
    if (this.isRunning) await this.stop();
    await AudioService.initialize();
    const socketConnected = await DeviceSocketService.connect(config.socketServerUrl);
    if (!socketConnected) return false;

    try {
      await DrawOverNativeModule.startFloatingBubble();
    } catch (error) {
      logger.warn('Foreground service host could not start; keeping socket connected in-app', error);
    }

    const notificationToken = NotificationService.getToken();
    const { getDeviceInfo } = require('../utils/device-info');
    const deviceInfo = await getDeviceInfo();

    await DeviceSocketService.registerDevice({
      deviceId: config.deviceId, userId: config.userId,
      userType: config.frontendName,
      frontendName: config.frontendName, notificationToken, deviceInfo, socketServerUrl: config.socketServerUrl,
    });

    this.isRunning = true;
    this.runningUserId = config.userId;
    return true;
  }

  async stop(): Promise<void> {
    DeviceSocketService.disconnect();
    try {
      await DrawOverNativeModule.stopFloatingBubble();
    } catch (error) {
      logger.warn('Foreground service host could not stop cleanly', error);
    }
    await AudioService.stopAlert();
    await NotificationService.cancelAll();
    this.isRunning = false;
    this.runningUserId = null;
  }

  isServicesRunning(): boolean { return this.isRunning; }
}

export default new BackgroundService();