import * as Notifications from 'expo-notifications';
import { Platform, Linking, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { logger } from '../utils/logger';

export interface PermissionStatus { notification: boolean; }

class PermissionManager {
  async requestCriticalPermissions(): Promise<PermissionStatus> {
    return { notification: await this.requestNotificationPermission() };
  }

  async requestNotificationPermission(): Promise<boolean> {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') return true;
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) { logger.error('Notification permission error:', error); return false; }
  }

  async check(permissionType: string): Promise<string> {
    if (permissionType === 'notification') return (await Notifications.getPermissionsAsync()).status;
    return 'unsupported';
  }

  async request(permissionType: string): Promise<string> {
    if (permissionType === 'notification') return (await this.requestNotificationPermission()) ? 'granted' : 'denied';
    return 'unsupported';
  }

  async openAppSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') await Linking.openURL('app-settings:');
      else await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: 'package:com.bidz4u.app' });
    } catch (error) {
      logger.error('Error opening settings:', error);
      Alert.alert('Error', 'Could not open settings.');
    }
  }
}

export default new PermissionManager();