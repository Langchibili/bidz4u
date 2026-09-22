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

interface OrderNotifData {
  orderId: number | string; orderNumber?: string; tableNumber?: number | string;
  itemCount?: number; total?: number;
}
interface WaiterCallNotifData {
  callId: number | string; tableNumber?: number | string; message?: string;
}

class NotificationService {
  private notificationToken: string | null = null;
  private sendToWebView: WebViewSender | null = null;
  private notificationListener: Notifications.Subscription | null = null;
  private responseListener: Notifications.Subscription | null = null;

  async initialize(sendToWebView: WebViewSender): Promise<void> {
    this.sendToWebView = sendToWebView;
    const { status } = await this.requestPermissions();
    if (status !== 'granted') { logger.warn('Notification permission not granted'); return; }
    await this.registerForPushNotifications();
    this.setupListeners();
    await this.registerCategories();
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
    await Notifications.setNotificationChannelAsync('order-alerts', {
      name: 'Order Alerts', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250], sound: 'order_alert.wav',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, bypassDnd: true, showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('waiter-calls', {
      name: 'Waiter Calls', importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250], sound: 'waiter_call.wav', bypassDnd: true, showBadge: true,
    });
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  private async registerCategories() {
    await Notifications.setNotificationCategoryAsync('order_new', [
      { identifier: 'open', buttonTitle: 'View Order', options: { opensAppToForeground: true } },
    ]);
    await Notifications.setNotificationCategoryAsync('waiter_call', [
      { identifier: 'open', buttonTitle: 'View Table', options: { opensAppToForeground: true } },
    ]);
  }

  private setupListeners() {
    this.notificationListener = Notifications.addNotificationReceivedListener((n) => {
      this.sendToWebView?.({ type: 'NOTIFICATION_RECEIVED', payload: { title: n.request.content.title, body: n.request.content.body, data: n.request.content.data } });
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data.type === 'order_new') {
        this.sendToWebView?.({ type: 'ORDER_NOTIFICATION_TAPPED', payload: data });
      } else if (data.type === 'waiter_call') {
        this.sendToWebView?.({ type: 'WAITER_CALL_NOTIFICATION_TAPPED', payload: data });
      }
    });
  }

  async show(notification: { title: string; body: string; data?: any; sound?: string; channelId?: string }) {
    await Notifications.scheduleNotificationAsync({
      content: { title: notification.title, body: notification.body, data: notification.data || {}, sound: notification.sound || 'default' },
      trigger: null,
    });
  }

  async showOrderNotification(data: OrderNotifData): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🍽️ New Order!',
        body: `Table ${data.tableNumber ?? '-'} — ${data.itemCount ?? 0} item(s) — K${(data.total ?? 0).toFixed(2)}`,
        data: { type: 'order_new', ...data },
        sound: 'order_alert.wav',
        categoryIdentifier: 'order_new',
        badge: 1,
        ...(Platform.OS === 'android' && { priority: Notifications.AndroidNotificationPriority.MAX, vibrate: [0, 250, 250, 250] }),
      },
      trigger: null,
      identifier: `order-${data.orderId}`,
    });
    this.sendToWebView?.({ type: 'ORDER_NOTIFICATION_SHOWN', payload: data });
  }

  async showWaiterCallNotification(data: WaiterCallNotifData): Promise<void> {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🔔 Waiter Needed!',
        body: `Table ${data.tableNumber ?? '-'} ${data.message ? `— ${data.message}` : 'needs assistance'}`,
        data: { type: 'waiter_call', ...data },
        sound: 'waiter_call.wav',
        categoryIdentifier: 'waiter_call',
        badge: 1,
        ...(Platform.OS === 'android' && { priority: Notifications.AndroidNotificationPriority.MAX, vibrate: [0, 250, 250, 250] }),
      },
      trigger: null,
      identifier: `call-${data.callId}`,
    });
    this.sendToWebView?.({ type: 'WAITER_CALL_NOTIFICATION_SHOWN', payload: data });
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.dismissAllNotificationsAsync();
  }

  getToken(): string | null { return this.notificationToken; }

  async handleBackgroundNotification(notification: any): Promise<void> {
    const data = notification.data;
    if (data.type === 'order_new') await this.showOrderNotification(data);
    else if (data.type === 'waiter_call') await this.showWaiterCallNotification(data);
  }

  cleanup() {
    this.notificationListener?.remove();
    this.responseListener?.remove();
    this.notificationListener = null;
    this.responseListener = null;
  }
}

export default new NotificationService();