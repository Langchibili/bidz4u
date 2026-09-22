import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StatusBar, Platform, AppState, StyleSheet, View, BackHandler, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import NetInfo from '@react-native-community/netinfo';

import BackgroundService from './src/services/BackgroundService';
import DeviceSocketService from './src/services/DeviceSocketService';
import LocationService from './src/services/LocationService';
import NotificationService from './src/services/NotificationService';
import PermissionManager from './src/services/PermissionManager';
import AudioService from './src/services/AudioService';
import { getDeviceInfo } from './src/utils/device-info';
import { logger } from './src/utils/logger';
import { SOCKET_EVENTS, WEBVIEW_EVENTS, CONSTANTS } from './src/utils/constants';
import { OrderAlertModal } from './src/components/OrderAlertModal';
import { WaiterCallAlertModal } from './src/components/WaiterCallAlertModal';
import { LinearGradient } from 'expo-linear-gradient';
import { ConnectionLostBanner } from './src/components/ConnectionLostBanner';
import OfflineScreen from './src/components/OfflineScreen';

const API_URL = CONSTANTS.BACKEND_URL;
const FRONTEND_URL = CONSTANTS.FRONTEND_URLS.owner;

export default function AppContent() {
  const webViewRef = useRef<WebView>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [is404, setIs404] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);

  const deviceIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | number | null>(null);
  const frontendNameRef = useRef<string | null>(null); // 'owner' | 'employee'

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showOrderModal) { setShowOrderModal(false); return true; }
      if (showCallModal) { setShowCallModal(false); return true; }
      if (is404) { setIs404(false); webViewRef.current?.injectJavaScript(`window.location = ""`); return true; }
      if (canGoBack && webViewRef.current) { webViewRef.current.goBack(); return true; }
      return false;
    });
    return () => backHandler.remove();
  }, [showOrderModal, showCallModal, is404, canGoBack]);

  const sendToWebView = useCallback((data: any) => {
    webViewRef.current?.postMessage(JSON.stringify({ type: data.type, payload: data.payload ?? {} }));
  }, []);

  const handleAcceptOrder = async (orderId: string | number) => {
    setShowOrderModal(false);
    try {
      const { deviceId } = await getDeviceInfo();
      await fetch(`${API_URL}/devices/acceptorder/${deviceId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: 'accepted' }),
      });
      setCurrentOrder(null);
    } catch (e) { logger.error('Accept order error:', e); }
  };

  const handleDismissOrder = (orderId: string | number) => { setShowOrderModal(false); setCurrentOrder(null); };

  const handleAcknowledgeCall = async (callId: string | number) => {
    setShowCallModal(false);
    try {
      const { deviceId } = await getDeviceInfo();
      await fetch(`${API_URL}/devices/acknowledgecall/${deviceId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callId }),
      });
      setCurrentCall(null);
    } catch (e) { logger.error('Acknowledge call error:', e); }
  };

  const handleDismissCall = (callId: string | number) => { setShowCallModal(false); setCurrentCall(null); };

  const setupSocketListeners = useCallback(() => {
    DeviceSocketService.on(SOCKET_EVENTS.ORDER.NEW, async (data: any) => {
      await BackgroundService.showOrderAlert(data);
      setCurrentOrder(data);
      setShowOrderModal(true);
      sendToWebView({ type: WEBVIEW_EVENTS.ORDER_NEW, payload: data });
    });

    DeviceSocketService.on(SOCKET_EVENTS.ORDER.STATUS_UPDATED, (data: any) => {
      sendToWebView({ type: WEBVIEW_EVENTS.ORDER_STATUS_UPDATED, payload: data });
    });

    DeviceSocketService.on(SOCKET_EVENTS.WAITER_CALL.NEW, async (data: any) => {
      await BackgroundService.showWaiterCallAlert(data);
      setCurrentCall(data);
      setShowCallModal(true);
      sendToWebView({ type: WEBVIEW_EVENTS.WAITER_CALL_NEW, payload: data });
    });

    DeviceSocketService.on(SOCKET_EVENTS.WAITER_CALL.ACKNOWLEDGED, (data: any) => {
      sendToWebView({ type: WEBVIEW_EVENTS.WAITER_CALL_ACKNOWLEDGED, payload: data });
    });

    DeviceSocketService.on(SOCKET_EVENTS.TABLE.STATUS_UPDATED, (data: any) => {
      sendToWebView({ type: WEBVIEW_EVENTS.TABLE_STATUS_UPDATED, payload: data });
    });

    DeviceSocketService.on(SOCKET_EVENTS.NOTIFICATION.NEW, async (data: any) => {
      await NotificationService.show(data);
      sendToWebView({ type: WEBVIEW_EVENTS.NOTIFICATION_NEW, payload: data });
    });

    DeviceSocketService.on(SOCKET_EVENTS.CONNECTED, () => sendToWebView({ type: WEBVIEW_EVENTS.SOCKET_CONNECTED, payload: {} }));
    DeviceSocketService.on(SOCKET_EVENTS.DISCONNECTED, (d: any) => sendToWebView({ type: WEBVIEW_EVENTS.SOCKET_DISCONNECTED, payload: d }));
  }, [sendToWebView]);

  useEffect(() => {
    NotificationService.initialize(sendToWebView);
    return () => NotificationService.cleanup();
  }, [sendToWebView]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => setIsConnected(state.isConnected ?? false));
    return () => unsub();
  }, []);

  const handleInitializeServices = async (payload: any) => {
    try {
      const { userId, frontendName, socketServerUrl } = payload;
      const deviceInfo = await getDeviceInfo();
      const deviceId = deviceInfo.deviceId;
      deviceIdRef.current = deviceId; userIdRef.current = userId; frontendNameRef.current = frontendName;
      LocationService.setDeviceId(deviceId);
      const permissions = await PermissionManager.requestCriticalPermissions();
      if (!permissions.location) return { success: false, error: 'Location permission required' };
      const socketUrl = socketServerUrl || CONSTANTS.DEVICE_SOCKET_URL;
      const started = await BackgroundService.start({ deviceId, userId, frontendName, socketServerUrl: socketUrl });
      if (!started) return { success: false, error: 'Failed to start services' };
      setupSocketListeners();
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
        case 'GET_CURRENT_LOCATION': response = await LocationService.getCurrentLocation() || { error: 'Could not get location' }; break;
        case 'SHOW_NOTIFICATION': await NotificationService.show(payload); response = { success: true }; break;
        case 'PLAY_AUDIO': await AudioService.playAlert(payload.soundFile); response = { success: true }; break;
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
      <OrderAlertModal open={showOrderModal} order={currentOrder} onAccept={handleAcceptOrder} onDismiss={handleDismissOrder} />
      <WaiterCallAlertModal open={showCallModal} call={currentCall} onAcknowledge={handleAcknowledgeCall} onDismiss={handleDismissCall} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  webview: { flex: 1 },
});