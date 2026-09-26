import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StatusBar, StyleSheet, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';

import BackgroundService from './src/services/BackgroundService';
import DeviceSocketService from './src/services/DeviceSocketService';
import NotificationService from './src/services/NotificationService';
import PermissionManager from './src/services/PermissionManager';
import AudioService from './src/services/AudioService';
import { getDeviceInfo } from './src/utils/device-info';
import { logger } from './src/utils/logger';
import { SOCKET_EVENTS, WEBVIEW_EVENTS, CONSTANTS } from './src/utils/constants';
import { LinearGradient } from 'expo-linear-gradient';
import { ConnectionLostBanner } from './src/components/ConnectionLostBanner';
import OfflineScreen from './src/components/OfflineScreen';

const FRONTEND_URL = CONSTANTS.FRONTEND_URLS.bidder;

export default function AppContent() {
  const webViewRef = useRef<WebView>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [is404, setIs404] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const deviceIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | number | null>(null);
  const frontendNameRef = useRef<'bidder' | 'seller'>('bidder');
  const notificationInitializationRef = useRef<Promise<void> | null>(null);
  const socketListenersReadyRef = useRef(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (is404) { setIs404(false); webViewRef.current?.injectJavaScript(`window.location = ""`); return true; }
      if (canGoBack && webViewRef.current) { webViewRef.current.goBack(); return true; }
      return false;
    });
    return () => backHandler.remove();
  }, [is404, canGoBack]);

  const sendToWebView = useCallback((data: any) => {
    webViewRef.current?.postMessage(JSON.stringify({ type: data.type, payload: data.payload ?? {} }));
  }, []);

  const setupSocketListeners = useCallback(() => {
    DeviceSocketService.on(SOCKET_EVENTS.AUCTION.BID_PLACED, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.BID_PLACED, payload: data }));
    DeviceSocketService.on(SOCKET_EVENTS.AUCTION.EXTENDED, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.AUCTION_EXTENDED, payload: data }));
    DeviceSocketService.on(SOCKET_EVENTS.AUCTION.CLOSED, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.AUCTION_CLOSED, payload: data }));
    DeviceSocketService.on(SOCKET_EVENTS.PAYMENT.REQUIRED, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.PAYMENT_REQUIRED, payload: data }));
    DeviceSocketService.on(SOCKET_EVENTS.PAYMENT.SUCCESS, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.PAYMENT_SUCCESS, payload: data }));
    DeviceSocketService.on(SOCKET_EVENTS.PAYMENT.FAILED, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.PAYMENT_FAILED, payload: data }));

    DeviceSocketService.on(SOCKET_EVENTS.NOTIFICATION.NEW, async (data: any) => {
      try {
        await NotificationService.show(data);
      } catch (error) {
        logger.warn('Could not display local notification', error);
      }
      sendToWebView({ type: WEBVIEW_EVENTS.NOTIFICATION_NEW, payload: data });
    });
    DeviceSocketService.on(SOCKET_EVENTS.DEVICE.SESSION_REPLACED, (data: any) => sendToWebView({ type: WEBVIEW_EVENTS.SESSION_REPLACED, payload: data }));

    DeviceSocketService.on(SOCKET_EVENTS.CONNECTED, () => sendToWebView({ type: WEBVIEW_EVENTS.SOCKET_CONNECTED, payload: {} }));
    DeviceSocketService.on(SOCKET_EVENTS.DISCONNECTED, (d: any) => sendToWebView({ type: WEBVIEW_EVENTS.SOCKET_DISCONNECTED, payload: d }));
  }, [sendToWebView]);

  useEffect(() => () => NotificationService.cleanup(), []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsConnected(state.isConnected ?? false));
    return () => unsub();
  }, []);

  const handleInitializeServices = async (payload: any) => {
    try {
      const { userId, userType, socketServerUrl } = payload;
      const frontendName: 'bidder' | 'seller' = userType === 'seller' ? 'seller' : 'bidder';
      if (!notificationInitializationRef.current) {
        notificationInitializationRef.current = NotificationService.initialize(sendToWebView);
      }
      try {
        await notificationInitializationRef.current;
      } catch (error) {
        logger.warn('Notification setup failed; continuing with permissions and socket services', error);
      }
      const deviceInfo = await getDeviceInfo();
      const deviceId = deviceInfo.deviceId;
      deviceIdRef.current = deviceId; userIdRef.current = userId; frontendNameRef.current = frontendName;
      const permissions = { notification: await PermissionManager.requestNotificationPermission() };
      if (!socketListenersReadyRef.current) {
        setupSocketListeners();
        socketListenersReadyRef.current = true;
      }
      const socketUrl = socketServerUrl || CONSTANTS.DEVICE_SOCKET_URL;
      const started = await BackgroundService.start({ deviceId, userId, frontendName, socketServerUrl: socketUrl });
      if (!started) return { success: false, error: 'Failed to start services' };
      return { success: true, deviceId, permissions, socketConnected: DeviceSocketService.isConnected() };
    } catch (e: any) { return { success: false, error: e.message }; }
  };

  const onMessage = async (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      const { type, requestId, payload } = message;
      let response: any = null;
      switch (type) {
        case 'INITIALIZE_SERVICES': response = await handleInitializeServices(payload); break;
        case 'REQUEST_PERMISSION': response = { status: await PermissionManager.request(payload.permissionType) }; break;
        case 'CHECK_PERMISSION': response = { status: await PermissionManager.check(payload.permissionType) }; break;
        case 'SHOW_NOTIFICATION': await NotificationService.show(payload); response = { success: true }; break;
        case 'PLAY_AUDIO': await AudioService.playAlert(payload.soundFile); response = { success: true }; break;
        case 'RECONNECT_SOCKET': response = { success: await BackgroundService.start({ deviceId: deviceIdRef.current || '', userId: userIdRef.current || '', frontendName: frontendNameRef.current, socketServerUrl: payload.socketServerUrl || CONSTANTS.DEVICE_SOCKET_URL }) }; break;
        case 'DISCONNECT_SOCKET': await BackgroundService.stop(); response = { success: true }; break;
        case 'LOG_DATA': console.log('Log from webview', payload); response = { success: true }; break;
        default: response = { error: 'Unknown message type' };
      }
      if (requestId && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify({ type, requestId, payload: response?.error ? null : response, error: response?.error }));
      }
    } catch (e) { logger.error('onMessage error:', e); }
  };

  if (!isConnected) {
    return <OfflineScreen onRetry={() => webViewRef.current?.injectJavaScript(`window.location = ""`)} />;
  }

  return (
    <LinearGradient colors={['#FFFFFF', '#FFFFFF']} style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ConnectionLostBanner visible={hasError || !isConnected} onRetry={() => webViewRef.current?.injectJavaScript(`window.location = ""`)} message={!isConnected ? 'No internet connection' : 'Connection lost'} />
      <SafeAreaView style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: FRONTEND_URL }}
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith('tel:') || request.url.startsWith('mailto:')) { Linking.openURL(request.url); return false; }
            return true;
          }}
          onMessage={onMessage}
          javaScriptEnabled domStorageEnabled startInLoadingState
          style={styles.webview}
          onNavigationStateChange={(nav) => setCanGoBack(nav.canGoBack)}
          onError={() => setHasError(true)}
          onLoadEnd={() => setIsLoading(false)}
          onHttpError={(e) => { if (e.nativeEvent.statusCode === 404) setIs404(true); }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1 },
});