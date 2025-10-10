import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '@/contexts/socket-context';
import { getCurrentUser } from '@/lib/auth-utils';

interface BreakExpirationState {
  expiredSessions: Set<number>;
  isLoading: boolean;
  error: string | null;
}

export function useBreakExpiration() {
  const [state, setState] = useState<BreakExpirationState>({
    expiredSessions: new Set(),
    isLoading: false,
    error: null
  });
  
  const { socket } = useSocket();

  // Check if a specific break session is expired
  const checkSessionExpiration = useCallback(async (sessionId: number): Promise<boolean> => {
    try {
      const response = await fetch(`/api/breaks/session/${sessionId}/expired`);
      if (!response.ok) {
        throw new Error('Failed to check session expiration');
      }
      
      const { isExpired } = await response.json();
      
      // Update state
      setState(prev => ({
        ...prev,
        expiredSessions: isExpired 
          ? new Set([...prev.expiredSessions, sessionId])
          : new Set([...prev.expiredSessions].filter(id => id !== sessionId))
      }));
      
      return isExpired;
    } catch (error) {
      console.error('Error checking session expiration:', error);
      setState(prev => ({ ...prev, error: 'Failed to check expiration' }));
      return false;
    }
  }, []);

  // Mark all expired breaks and get session status
  const markExpiredBreaks = useCallback(async (): Promise<{ expiredCount: number; sessions: any[] }> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await fetch('/api/breaks/mark-expired', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Failed to mark expired breaks: ${errorMessage}`);
      }
      
      const { expiredCount, sessions } = await response.json();
      
      // Update state with all session expiration status
      const expiredSessions = new Set<number>(
        sessions.filter((session: any) => session.is_expired).map((session: any) => session.id)
      );
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: null,
        expiredSessions
      }));
      
      return { expiredCount, sessions };
    } catch (error) {
      console.error('Error marking expired breaks:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark expired breaks';
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: errorMessage
      }));
      return { expiredCount: 0, sessions: [] };
    }
  }, []);

  // Check if a session is expired (from state)
  const isSessionExpired = useCallback((sessionId: number): boolean => {
    return state.expiredSessions.has(sessionId);
  }, [state.expiredSessions]);

  // Socket event listeners for real-time break expiration updates
  useEffect(() => {
    if (!socket) return;

    const handleBreakExpirationUpdate = (data: { expiredCount: number; sessions: any[] }) => {
      const expiredSessions = new Set<number>(
        data.sessions.filter((session: any) => session.is_expired).map((session: any) => session.id)
      );
      
      setState(prev => ({ 
        ...prev, 
        expiredSessions,
        isLoading: false,
        error: null
      }));
    };

    const handleBreakExpirationError = (data: { message: string }) => {
      setState(prev => ({ 
        ...prev, 
        error: data.message,
        isLoading: false
      }));
    };

    socket.on('break-expiration-updated', handleBreakExpirationUpdate);
    socket.on('break-expiration-error', handleBreakExpirationError);

    return () => {
      socket.off('break-expiration-updated', handleBreakExpirationUpdate);
      socket.off('break-expiration-error', handleBreakExpirationError);
    };
  }, [socket]);

  // Request break expiration check via socket
  const requestBreakExpirationCheck = useCallback(() => {
    if (!socket) return;
    
    const currentUser = getCurrentUser();
    if (currentUser?.id) {
      socket.emit('check-break-expiration', { userId: currentUser.id });
    }
  }, [socket]);

  // Auto-refresh expired breaks only when socket is not available
  // When socket is available, updates are event-driven and don't need polling
  useEffect(() => {
    if (socket) {
      // Socket is available - no need for interval polling
      // Updates will be handled by socket events
      return;
    }

    // Fallback: Use interval only when socket is not available
    const interval = setInterval(() => {
      markExpiredBreaks();
    }, 2 * 60 * 1000); // 2 minutes

    return () => clearInterval(interval);
  }, [socket, markExpiredBreaks]);

  // Mark expired breaks on mount
  useEffect(() => {
    if (socket) {
      requestBreakExpirationCheck();
    } else {
      markExpiredBreaks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestBreakExpirationCheck, markExpiredBreaks]);

  return {
    isSessionExpired,
    checkSessionExpiration,
    markExpiredBreaks,
    requestBreakExpirationCheck,
    expiredSessions: state.expiredSessions,
    isLoading: state.isLoading,
    error: state.error
  };
}
