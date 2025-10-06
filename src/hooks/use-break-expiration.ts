import { useState, useEffect, useCallback } from 'react';

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
        throw new Error('Failed to mark expired breaks');
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
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: 'Failed to mark expired breaks' 
      }));
      return { expiredCount: 0, sessions: [] };
    }
  }, []);

  // Check if a session is expired (from state)
  const isSessionExpired = useCallback((sessionId: number): boolean => {
    return state.expiredSessions.has(sessionId);
  }, [state.expiredSessions]);

  // Auto-refresh expired breaks every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      markExpiredBreaks();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [markExpiredBreaks]);

  // Mark expired breaks on mount
  useEffect(() => {
    markExpiredBreaks();
  }, [markExpiredBreaks]);

  return {
    isSessionExpired,
    checkSessionExpiration,
    markExpiredBreaks,
    expiredSessions: state.expiredSessions,
    isLoading: state.isLoading,
    error: state.error
  };
}
