'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Badge,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { useNotifications } from '@/lib/contexts/NotificationsContext';

export default function NotificationInbox() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    pageCount,
    loadNotifications,
    setNotificationRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    loadNotifications({ page, unread: filter === 'unread' })
      .catch((loadError) => { if (!cancelled) setError(loadError.message || 'Could not load notifications.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, page, filter, loadNotifications]);

  const setFilterAndPage = (nextFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  const toggleRead = async (event, notification) => {
    event.stopPropagation();
    try {
      await setNotificationRead(notification, !notification.isRead);
      if (filter === 'unread' && !notification.isRead) {
        await loadNotifications({ page: Math.min(page, pageCount), unread: true });
      }
    } catch (requestError) {
      setError(requestError.message || 'Could not update notification.');
    }
  };

  const openRelatedAuction = (notification) => {
    const auctionId = notification.data?.auctionItemId;
    if (auctionId) {
      setOpen(false);
      router.push(`/auction/${auctionId}`);
    }
  };

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} onClick={() => setOpen(true)}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Notifications</Typography>
            <Typography variant="caption" color="text.secondary">{unreadCount} unread</Typography>
          </Box>
          <Button onClick={async () => {
            try {
              await markAllRead();
              if (filter === 'unread') await loadNotifications({ page: 1, unread: true });
            } catch (requestError) {
              setError(requestError.message || 'Could not mark all as read.');
            }
          }} disabled={!unreadCount}>
            Mark all read
          </Button>
        </DialogTitle>
        <Tabs value={filter} onChange={(_, value) => setFilterAndPage(value)} variant="fullWidth">
          <Tab value="all" label="All" />
          <Tab value="unread" label="Unread" />
        </Tabs>
        <DialogContent dividers sx={{ minHeight: 300, p: 0 }}>
          {error && <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>}
          {loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 260 }}><CircularProgress size={28} /></Stack>
          ) : notifications.length ? (
            <List disablePadding>
              {notifications.map((notification, index) => (
                <Box key={notification.id || `${notification.title}-${notification.createdAt}-${index}`}>
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => openRelatedAuction(notification)}
                    sx={{ cursor: notification.data?.auctionItemId ? 'pointer' : 'default', bgcolor: notification.isRead ? 'transparent' : 'action.hover', gap: 1, py: 1.5 }}
                    secondaryAction={(
                      <Button size="small" onClick={(event) => toggleRead(event, notification)} sx={{ textTransform: 'none', minWidth: 86 }}>
                        Mark {notification.isRead ? 'unread' : 'read'}
                      </Button>
                    )}
                  >
                    {!notification.isRead && <Box sx={{ width: 8, height: 8, mt: 1, flexShrink: 0, borderRadius: '50%', bgcolor: 'secondary.main' }} />}
                    <ListItemText
                      primary={notification.title}
                      secondary={(
                        <>
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>{notification.body}</Typography>
                          <Typography component="span" variant="caption" color="text.disabled">{new Date(notification.createdAt).toLocaleString()}</Typography>
                        </>
                      )}
                      primaryTypographyProps={{ fontWeight: notification.isRead ? 500 : 750 }}
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider component="li" />}
                </Box>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary" align="center" sx={{ py: 7 }}>No {filter === 'unread' ? 'unread ' : ''}notifications.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} size="small" color="secondary" />
        </DialogActions>
      </Dialog>
    </>
  );
}
