import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsApi } from '../../../api/apiservice';
import { useAuth } from '../../auth/context/AuthContext';

const NotificationContext = createContext(null);

export function getNotificationPriority(item) {
  if (!item) return { label: 'INFO', color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' };
  
  const code = (item.event_code || '').toUpperCase();
  const title = (item.title || '').toUpperCase();
  const module = (item.source_module || '').toUpperCase();

  if (
    code.includes('REJECT') || 
    code.includes('CANCEL') || 
    code.includes('CRITICAL') || 
    code.includes('OVERDUE') ||
    code.includes('FAIL') ||
    title.includes('CRITICAL') ||
    title.includes('URGENT') ||
    title.includes('REJECTED')
  ) {
    return { label: 'CRITICAL', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' };
  }

  if (
    code.includes('SUBMIT') || 
    code.includes('PENDING') || 
    code.includes('WARNING') || 
    code.includes('VARIANCE') ||
    code.includes('APPROVE') ||
    title.includes('ACTION') ||
    title.includes('APPROVAL') ||
    title.includes('DELAY')
  ) {
    return { label: 'HIGH', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
  }

  if (
    code.includes('APPROVED') || 
    code.includes('RESOLVED') || 
    code.includes('COMPLETED') ||
    title.includes('APPROVED') ||
    title.includes('SUCCESS')
  ) {
    return { label: 'SUCCESS', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' };
  }

  return { label: 'INFO', color: '#0056C9', bg: '#EFF6FF', border: '#BFDBFE' };
}

export function formatNotificationTime(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

export function NotificationProvider({ children }) {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeToasts, setActiveToasts] = useState([]);
  const hasTriggeredLoginPopupsRef = useRef(false);
  const lastUserIdRef = useRef(null);

  // Fetch notifications from real backend API
  const fetchNotifications = useCallback(async () => {
    if (!session?.user) return;
    try {
      setIsLoading(true);
      const res = await notificationsApi.list();
      const list = res?.data?.notifications || (Array.isArray(res?.data) ? res.data : []);
      setNotifications(Array.isArray(list) ? list : []);
      return list;
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, is_read: 1, read_at: new Date().toISOString() } : n)
      );
      // Remove from active toasts if present
      setActiveToasts(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: 1, read_at: new Date().toISOString() }))
      );
      setActiveToasts([]);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Dismiss a toast from bottom queue
  const dismissToast = useCallback((toastId) => {
    setActiveToasts(prev => prev.filter(t => t.id !== toastId));
  }, []);

  // Trigger toasts sequentially one by one
  const triggerSequentialToasts = useCallback((items) => {
    if (!items || items.length === 0) return;

    // Take up to 4 most recent unread items
    const toShow = items.slice(0, 4);

    toShow.forEach((item, index) => {
      setTimeout(() => {
        setActiveToasts(prev => {
          if (prev.some(t => t.id === item.id)) return prev;
          return [...prev, item];
        });

        // Auto dismiss individual toast after 7 seconds
        setTimeout(() => {
          setActiveToasts(prev => prev.filter(t => t.id !== item.id));
        }, 7000);
      }, (index + 1) * 1200); // 1.2s delay between each popup
    });
  }, []);

  // On Login / session change: fetch and trigger sequential popups
  useEffect(() => {
    if (session?.user) {
      const currentUserId = session.user.id;
      if (lastUserIdRef.current !== currentUserId) {
        lastUserIdRef.current = currentUserId;
        hasTriggeredLoginPopupsRef.current = false;
      }

      fetchNotifications().then((list) => {
        if (!hasTriggeredLoginPopupsRef.current && list && list.length > 0) {
          hasTriggeredLoginPopupsRef.current = true;
          const unreadList = list.filter(n => !n.is_read || n.is_read === 0 || n.is_read === '0');
          if (unreadList.length > 0) {
            triggerSequentialToasts(unreadList);
          }
        }
      });
    } else {
      setNotifications([]);
      setActiveToasts([]);
      hasTriggeredLoginPopupsRef.current = false;
      lastUserIdRef.current = null;
    }
  }, [session, fetchNotifications, triggerSequentialToasts]);

  const unreadCount = notifications.filter(
    n => !n.is_read || n.is_read === 0 || n.is_read === '0'
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications: fetchNotifications,
        activeToasts,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
