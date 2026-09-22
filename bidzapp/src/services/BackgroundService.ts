import DeviceSocketService from './DeviceSocketService';
import NotificationService from './NotificationService';
import AudioService from './AudioService';
import { logger } from '../utils/logger';

interface ServiceConfig { deviceId: string; userId: string | number; frontendName: string; socketServerUrl: string; }

class BackgroundService {
  private isRunning = false;

  async start(config: ServiceConfig): Promise<boolean> {
    if (this.isRunning) return true;
    await AudioService.initialize();
    const socketConnected = await DeviceSocketService.connect(config.socketServerUrl);
    if (!socketConnected) return false;

    const notificationToken = NotificationService.getToken();
    const { getDeviceInfo } = require('../utils/device-info');
    const deviceInfo = await getDeviceInfo();

    await DeviceSocketService.registerDevice({
      deviceId: config.deviceId, userId: config.userId,
      userType: config.frontendName === 'owner' ? 'owner' : 'employee',
      frontendName: config.frontendName, notificationToken, deviceInfo, socketServerUrl: config.socketServerUrl,
    });

    this.isRunning = true;
    return true;
  }

  async stop(): Promise<void> {
    DeviceSocketService.disconnect();
    await AudioService.stopAlert();
    await NotificationService.cancelAll();
    this.isRunning = false;
  }

  async showOrderAlert(orderData: any): Promise<void> {
    await AudioService.playAlert('order_alert');
    await NotificationService.showOrderNotification(orderData);
  }

  async showWaiterCallAlert(callData: any): Promise<void> {
    await AudioService.playAlert('waiter_call');
    await NotificationService.showWaiterCallNotification(callData);
  }

  isServicesRunning(): boolean { return this.isRunning; }
}

export default new BackgroundService();