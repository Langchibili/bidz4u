'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { GLOBAL_DEFAULTS } from '@/Constants';
import { apiClient } from '@/lib/api/client';
import { useAuth } from './AuthContext';
import { useReactNative } from './ReactNativeWrapper';

const NotificationsContext = createContext(null);

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}

export function NotificationsProvider({ children }) {
  const { user, hydrated, effectiveSettings } = useAuth();
  const { on: onNativeMessage } = useReactNative();
  const authenticated = Boolean(user && apiClient.getToken());
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [snackbar, setSnackbar] = useState(null);

  const loadNotifications = useCallback(async ({ page = 1, unread = false } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (unread) params.set('unread', 'true');
    const response = await apiClient.get(`/notifications/me?${params.toString()}`);
    setNotifications(Array.isArray(response?.data) ? response.data : []);
    setUnreadCount(Number(response?.unreadCount) || 0);
    setPageCount(Math.max(1, Number(response?.meta?.pagination?.pageCount) || 1));
    return response;
  }, []);

  useEffect(() => {
    if (!hydrated || !authenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }
    loadNotifications().catch((error) => console.warn('Failed to load notifications', error));
  }, [hydrated, authenticated, user?.id, loadNotifications]);

  useEffect(() => {
    const handleNotification = (event) => {
      const payload = event.detail || {};
      const storedId = payload.notificationId;
      const localId = storedId || `socket-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const notification = {
        id: localId,
        title: payload.title || 'Bidz4U update',
        body: payload.body || 'You have a new auction update.',
        notificationType: payload.notificationType || payload.data?.kind || 'general',
        data: payload.data || {},
        isRead: false,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      setNotifications((current) => [notification, ...current.filter((item) => String(item.id) !== String(localId))].slice(0, 20));
      setUnreadCount((count) => count + 1);
      setSnackbar({ ...notification, key: localId });
    };
    window.addEventListener('bidz4u:notification', handleNotification);
    return () => window.removeEventListener('bidz4u:notification', handleNotification);
  }, []);

  useEffect(() => onNativeMessage('NOTIFICATION_RECEIVED', (payload) => {
    window.dispatchEvent(new CustomEvent('bidz4u:notification', { detail: payload || {} }));
  }), [onNativeMessage]);

  const setNotificationRead = useCallback(async (notification, isRead) => {
    const id = Number(notification.id);
    if (Number.isInteger(id) && id > 0) {
      await apiClient.patch(`/notifications/${id}/${isRead ? 'read' : 'unread'}`, {});
    }
    setNotifications((current) => current.map((item) => String(item.id) === String(notification.id)
      ? { ...item, isRead, readAt: isRead ? new Date().toISOString() : null }
      : item));
    setUnreadCount((count) => Math.max(0, count + (isRead ? -1 : 1)));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiClient.post('/notifications/read-all', {});
    setNotifications((current) => current.map((item) => ({ ...item, isRead: true, readAt: new Date().toISOString() })));
    setUnreadCount(0);
  }, []);

  const timeoutSeconds = Number(effectiveSettings?.notificationAutoHideSeconds)
    || GLOBAL_DEFAULTS.FALLBACK_NOTIFICATION_AUTO_HIDE_SECONDS
    || 5;

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, pageCount, loadNotifications, setNotificationRead, markAllRead }}>
      {children}
      <Snackbar
        key={snackbar?.key || 'empty'}
        open={Boolean(snackbar)}
        autoHideDuration={timeoutSeconds * 1000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setSnackbar(null)}
        sx={{ zIndex: (theme) => theme.zIndex.snackbar + 2, mt: 6 }}
      >
        <Alert severity="info" variant="filled" onClose={() => setSnackbar(null)} sx={{ width: '100%', maxWidth: 560 }}>
          <strong>{snackbar?.title}</strong>
          {snackbar?.body && <div>{snackbar.body}</div>}
        </Alert>
      </Snackbar>
    </NotificationsContext.Provider>
  );
}
