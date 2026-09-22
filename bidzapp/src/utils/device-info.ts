import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Random from 'expo-random';

export async function getDeviceInfo(): Promise<any> {
  try {
    const deviceInfo = {
      deviceId: await getDeviceId(),
      deviceName: Device.deviceName || 'Unknown Device',
      platform: Platform.OS,
      platformVersion: Platform.Version,
      manufacturer: Device.manufacturer || 'Unknown',
      modelName: Device.modelName || 'Unknown',
      osName: Device.osName || Platform.OS,
      osVersion: Device.osVersion || String(Platform.Version),
      appVersion: Application.nativeApplicationVersion || '1.0.0',
      buildNumber: Application.nativeBuildVersion || '1',
      expoVersion: Constants.expoVersion || 'Unknown',
      isDevice: Device.isDevice,
      totalMemory: Device.totalMemory,
    }

    return deviceInfo;
  } catch (error) {
    console.error('Error getting device info:', error);
    return {
      deviceId: 'unknown',
      platform: Platform.OS,
    };
  }
}


async function getDeviceId(): Promise<string> {
  try {
    // Android - use getAndroidId (async in newer Expo versions)
    if (Platform.OS === 'android') {
      const androidId = await Application.getAndroidId();
      if (androidId) {
        return androidId;
      }
    }

    // iOS - use getIosIdForVendorAsync
    if (Platform.OS === 'ios') {
      const iosId = await Application.getIosIdForVendorAsync();
      if (iosId) {
        return iosId;
      }
    }

    // Fallback to Constants installationId if available
    if (Constants.installationId) {
      return Constants.installationId;
    }

    // Last resort - generate unique ID based on device info
    const uniqueId = `${Platform.OS}-${Device.modelName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return uniqueId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    // Generate fallback ID
    return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Get a persistent device identifier
 * This ID persists across app reinstalls on the same device
 */
export async function getPersistentDeviceId(): Promise<string> {
  try {
    let deviceId = '';

    if (Platform.OS === 'android') {
      // Android ID - persists across app reinstalls but resets on factory reset
      deviceId = (await Application.getAndroidId()) || '';
    } else if (Platform.OS === 'ios') {
      // iOS Vendor ID - persists until all apps from vendor are uninstalled
      deviceId = (await Application.getIosIdForVendorAsync()) || '';
    }

    // If we got a valid ID, return it
    if (deviceId) {
      return deviceId;
    }

    // Fallback
    return Constants.installationId || `fallback-${Date.now()}`;
  } catch (error) {
    console.error('Error getting persistent device ID:', error);
    return `error-${Date.now()}`;
  }
}

/**
 * Get installation-specific ID
 * This changes when app is reinstalled
 */
export function getInstallationId(): string {
  return Constants.installationId || `install-${Date.now()}`;
}