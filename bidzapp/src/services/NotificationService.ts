import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import { EXPO_PUBLIC_PROJECT_ID } from '../utils/constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

type WebViewSender = (data: any) => void;

class NotificationService {
  private notificationToken: string | null = null;
  private sendToWebView: WebViewSender | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  async initialize(sendToWebView: WebViewSender): Promise<void> {
    this.sendToWebView = sendToWebView;
    const { status } = await this.requestPermissions();
    if (status !== 'granted') { logger.warn('Notification permission not granted'); return; }
    try {
      await this.registerForPushNotifications();
    } catch (error) {
      logger.warn('Push token registration unavailable; socket notifications remain enabled', error);
    }
    this.setupListeners();
  }

  async requestPermissions(): Promise<{ status: string }> {
    if (!Device.isDevice) return { status: 'denied' };
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') finalStatus = (await Notifications.requestPermissionsAsync()).status;
    return { status: finalStatus };
  }

  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) return null;
    const token = await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PUBLIC_PROJECT_ID });
    this.notificationToken = token.data;
    if (Platform.OS === 'android') await this.setupAndroidChannels();
    return this.notificationToken;
  }

  private async setupAndroidChannels() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  private setupListeners() {
    this.notificationListener = Notifications.addNotificationReceivedListener((n) => {
      this.sendToWebView?.({ type: 'NOTIFICATION_RECEIVED', payload: { title: n.request.content.title, body: n.request.content.body, data: n.request.content.data } });
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      this.sendToWebView?.({ type: 'NOTIFICATION_TAPPED', payload: data });
    });
  }

  async show(notification: { title: string; body: string; data?: any; sound?: string; channelId?: string }) {
    await Notifications.scheduleNotificationAsync({
      content: { title: notification.title, body: notification.body, data: notification.data || {}, sound: notification.sound || 'default' },
      trigger: null,
    });
  }


  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  }

  getToken(): string | null { return this.notificationToken; }

  async handleBackgroundNotification(notification: any): Promise<void> {
    const data = notification.data || {};
    await this.show({ title: data.title || 'Bidz4u update', body: data.body || 'You have a new auction update.', data });
  }

  cleanup() {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.notificationListener = null;
    this.responseListener = null;
  }
}

export default new NotificationService();