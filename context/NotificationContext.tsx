import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { InfringementStatus } from '../types';

export type NotificationType =
  | 'admin_needs_input'
  | 'case_updated'
  | 'takedown_success'
  | 'takedown_partial'
  | 'takedown_failed'
  | 'case_dismissed';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  caseId: string;
  createdAt: string;
  isRead: boolean;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// Safe version that returns no-op functions when outside provider (for use in nested providers)
export function useNotificationsSafe() {
  const context = useContext(NotificationContext);
  if (!context) {
    return {
      notifications: [],
      unreadCount: 0,
      addNotification: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      clearNotification: () => {},
    };
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const addNotification = useCallback((notification: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>) => {
    const newNotification: AppNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50));
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function createStatusChangeNotification(
  caseId: string,
  brandName: string,
  newStatus: InfringementStatus
): Omit<AppNotification, 'id' | 'createdAt' | 'isRead'> | null {
  switch (newStatus) {
    case 'needs_member_input':
      return {
        type: 'admin_needs_input',
        title: 'Action Required',
        message: `Admin needs your input on case for ${brandName}`,
        caseId,
      };
    case 'resolved_success':
      return {
        type: 'takedown_success',
        title: 'Takedown Successful',
        message: `Case for ${brandName} has been successfully resolved`,
        caseId,
      };
    case 'resolved_partial':
      return {
        type: 'takedown_partial',
        title: 'Partial Takedown',
        message: `Case for ${brandName} was partially resolved`,
        caseId,
      };
    case 'resolved_failed':
      return {
        type: 'takedown_failed',
        title: 'Takedown Failed',
        message: `Takedown for ${brandName} was unsuccessful`,
        caseId,
      };
    case 'dismissed_by_admin':
      return {
        type: 'case_dismissed',
        title: 'Case Dismissed',
        message: `Admin dismissed the case for ${brandName}`,
        caseId,
      };
    default:
      return null;
  }
}
