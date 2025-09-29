'use client';

import { useState, useEffect } from 'react';
import { useTimer } from '@/contexts/timer-context';

export function SystemLockMonitor() {
  const { lastActivityState, liveActiveSeconds, liveInactiveSeconds } = useTimer();
  const [systemEvents, setSystemEvents] = useState<any[]>([]);
  const [isSystemLocked, setIsSystemLocked] = useState(false);

  useEffect(() => {
    // Listen for system lock/unlock events
    const handleSystemLock = () => {
      setIsSystemLocked(true);
      console.log('🔒 System locked - Timer should pause');
      // Fetch events when lock happens
      fetchRecentEvents();
    };

    const handleSystemUnlock = () => {
      setIsSystemLocked(false);
      console.log('🔓 System unlocked - Timer should resume');
      // Fetch events when unlock happens
      fetchRecentEvents();
    };

    if (window.electronAPI?.receive) {
      window.electronAPI.receive('system-lock', handleSystemLock);
      window.electronAPI.receive('system-unlock', handleSystemUnlock);
    }

    return () => {
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners('system-lock');
        window.electronAPI.removeAllListeners('system-unlock');
      }
    };
  }, []);

  const fetchRecentEvents = async () => {
    try {
      const response = await fetch('/api/system-events?limit=5');
      const data = await response.json();
      if (data.success) {
        setSystemEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching system events:', error);
    }
  };

  // Fetch events on component mount
  useEffect(() => {
    fetchRecentEvents();
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-md">
      <h3 className="text-lg font-semibold mb-4">System Lock Monitor</h3>
      
      {/* Current Status */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${isSystemLocked ? 'bg-red-500' : 'bg-green-500'}`}></div>
          <span className="font-medium">
            {isSystemLocked ? 'System Locked' : 'System Unlocked'}
          </span>
        </div>
        
        <div className="text-sm text-gray-600">
          Activity State: <span className={`font-medium ${lastActivityState ? 'text-green-600' : 'text-red-600'}`}>
            {lastActivityState === null ? 'Unknown' : lastActivityState ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Timer Display */}
      <div className="mb-4 p-3 bg-gray-50 rounded">
        <div className="text-sm text-gray-600 mb-1">Live Timer</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-500">Active</div>
            <div className="text-lg font-mono">{formatTime(liveActiveSeconds)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Inactive</div>
            <div className="text-lg font-mono">{formatTime(liveInactiveSeconds)}</div>
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div>
        <div className="text-sm font-medium mb-2">Recent System Events</div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {systemEvents.length === 0 ? (
            <div className="text-xs text-gray-500">No events yet</div>
          ) : (
            systemEvents.map((event) => (
              <div key={event.id} className="text-xs flex justify-between items-center">
                <span className={`px-2 py-1 rounded ${
                  event.event_type === 'lock' ? 'bg-red-100 text-red-800' :
                  event.event_type === 'unlock' ? 'bg-green-100 text-green-800' :
                  event.event_type === 'suspend' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {event.event_type}
                </span>
                <span className="text-gray-500">
                  {new Date(event.event_timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
        <strong>Test:</strong> Lock your PC (Win+L) and watch the timer pause immediately. 
        Unlock to see it resume.
      </div>
    </div>
  );
}
