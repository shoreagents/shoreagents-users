import { useEffect, useState, useCallback } from 'react';
import { useSocket } from './use-socket';

export interface ActivityData {
  id: number;
  user_id: number;
  is_currently_active: boolean;
  today_active_seconds: number;
  today_inactive_seconds: number;
  today_date: string;
  last_session_start: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityDataUpdate {
  user_id: number;
  action: 'INSERT' | 'UPDATE';
  table: string;
  data: ActivityData;
}

export function useActivityDataRealtime(userId: number) {
  const { socket, isConnected } = useSocket();
  const [activityData, setActivityData] = useState<ActivityData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Handle real-time updates
  const handleActivityDataUpdate = useCallback((update: ActivityDataUpdate) => {
    console.log('📡 Real-time activity data update received:', update);
    
    if (update.user_id === userId) {
      setActivityData(update.data);
      setLastUpdate(new Date());
      setIsLoading(false);
      
      console.log('✅ Activity data updated in real-time:', {
        active: update.data.today_active_seconds,
        inactive: update.data.today_inactive_seconds,
        isActive: update.data.is_currently_active
      });
    }
  }, [userId]);

  // Listen for real-time updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    console.log('🔌 Setting up real-time activity data listener for user:', userId);
    
    // Listen for activity data updates
    socket.on('activity-data-updated', handleActivityDataUpdate);
    
    // Listen for connection status
    socket.on('connect', () => {
      console.log('🔌 Socket connected, listening for activity data updates');
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Socket disconnected, stopping activity data updates');
    });

    return () => {
      console.log('🔌 Cleaning up activity data real-time listener');
      socket.off('activity-data-updated', handleActivityDataUpdate);
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket, isConnected, userId, handleActivityDataUpdate]);

  // Fetch initial data
  useEffect(() => {
    if (!isConnected) return;

    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/activity?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setActivityData(data);
          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('❌ Error fetching initial activity data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [userId, isConnected]);

  // Helper functions
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getActiveTime = (): string => {
    return activityData ? formatTime(activityData.today_active_seconds) : '0:00';
  };

  const getInactiveTime = (): string => {
    return activityData ? formatTime(activityData.today_inactive_seconds) : '0:00';
  };

  const getTotalTime = (): string => {
    if (!activityData) return '0:00';
    const total = activityData.today_active_seconds + activityData.today_inactive_seconds;
    return formatTime(total);
  };

  return {
    // Data
    activityData,
    lastUpdate,
    isLoading,
    
    // Formatted time values
    activeTime: getActiveTime(),
    inactiveTime: getInactiveTime(),
    totalTime: getTotalTime(),
    
    // Raw values
    activeSeconds: activityData?.today_active_seconds || 0,
    inactiveSeconds: activityData?.today_inactive_seconds || 0,
    isCurrentlyActive: activityData?.is_currently_active || false,
    
    // Helper functions
    formatTime,
    refresh: () => {
      setIsLoading(true);
      // Trigger a re-fetch
      setActivityData(null);
    }
  };
}
