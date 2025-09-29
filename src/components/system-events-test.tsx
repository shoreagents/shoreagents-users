'use client';

import { useState, useEffect } from 'react';

interface SystemEvent {
  id: number;
  event_type: string;
  event_timestamp: string;
  session_id: string;
  metadata: any;
}

interface SuspendStats {
  total_suspend_events: number;
  total_resume_events: number;
  total_lock_events: number;
  total_unlock_events: number;
  first_suspend_time: string | null;
  last_resume_time: string | null;
  total_suspend_duration_seconds: number;
}

export function SystemEventsTest() {
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [stats, setStats] = useState<SuspendStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/system-events');
      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/system-events?date=' + new Date().toISOString().split('T')[0], {
        method: 'PUT'
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, []);

  const testEvent = async (eventType: 'suspend' | 'resume' | 'lock' | 'unlock') => {
    try {
      // Use the same session ID for all system events (same as real system)
      // Get current user email for persistent session ID
      const authData = localStorage.getItem('shoreagents-auth');
      let userEmail = 'test_user';
      
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          userEmail = parsed.user?.email || 'test_user';
        } catch (error) {
          console.warn('Error parsing auth data:', error);
        }
      }
      
      const sessionKey = `currentSystemSessionId_${userEmail}`;
      
      let sessionId = localStorage.getItem(sessionKey);
      
      // Always check if we need to update the session ID based on current date
      const now = new Date();
      // Get Manila time properly by using toLocaleDateString with Manila timezone
      const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD format
      const expectedSessionId = `system_${userEmail.replace('@', '_').replace('.', '_')}_${today}`;
      
      if (!sessionId || !sessionId.includes(today)) {
        // Create new session ID if none exists or if date has changed
        sessionId = expectedSessionId;
        localStorage.setItem(sessionKey, sessionId);
      }
      
      const response = await fetch('/api/system-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType,
          sessionId,
          metadata: {
            reason: 'manual_test',
            timestamp: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Test ${eventType} event ${result.isUpdate ? 'updated' : 'recorded'}`);
        fetchEvents();
        fetchStats();
      } else {
        console.error(`❌ Failed to record ${eventType} event`);
      }
    } catch (error) {
      console.error('Error recording test event:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">System Events Test</h2>
      
      {/* Test Buttons */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Test Events</h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => testEvent('suspend')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Test Suspend
          </button>
          <button
            onClick={() => testEvent('resume')}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test Resume
          </button>
          <button
            onClick={() => testEvent('lock')}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
          >
            Test Lock
          </button>
          <button
            onClick={() => testEvent('unlock')}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Test Unlock
          </button>
          <button
            onClick={fetchEvents}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh Events'}
          </button>
          <button
            onClick={() => {
              // Get current user email to clear the correct session
              const authData = localStorage.getItem('shoreagents-auth');
              let userEmail = 'test_user';
              
              if (authData) {
                try {
                  const parsed = JSON.parse(authData);
                  userEmail = parsed.user?.email || 'test_user';
                } catch (error) {
                  console.warn('Error parsing auth data:', error);
                }
              }
              
              const sessionKey = `currentSystemSessionId_${userEmail}`;
              localStorage.removeItem(sessionKey);
              console.log(`🔄 Session ID cleared for ${userEmail} - next event will create new session`);
            }}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Clear Session
          </button>
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <h3 className="text-lg font-semibold mb-2">Today's Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Suspend Events</div>
              <div className="text-2xl font-bold">{stats.total_suspend_events}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Resume Events</div>
              <div className="text-2xl font-bold">{stats.total_resume_events}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Lock Events</div>
              <div className="text-2xl font-bold">{stats.total_lock_events}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Unlock Events</div>
              <div className="text-2xl font-bold">{stats.total_unlock_events}</div>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-sm text-gray-600">Total Suspend Duration</div>
            <div className="text-lg font-semibold">
              {Math.floor(stats.total_suspend_duration_seconds / 60)} minutes {stats.total_suspend_duration_seconds % 60} seconds
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Recent Events</h3>
        {events.length === 0 ? (
          <p className="text-gray-500">No events recorded yet. Try locking/unlocking your PC or use the test buttons above.</p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="p-3 border rounded flex justify-between items-center">
                <div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    event.event_type === 'suspend' ? 'bg-blue-100 text-blue-800' :
                    event.event_type === 'resume' ? 'bg-green-100 text-green-800' :
                    event.event_type === 'lock' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>
                    {event.event_type.toUpperCase()}
                  </span>
                  <span className="ml-2 text-sm text-gray-600">
                    {new Date(event.event_timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Session: {event.session_id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
        <div><strong>Real Test:</strong> Lock your PC (Win+L) and watch the timer pause immediately. Unlock to see it resume.</div>
        <div className="mt-1"><strong>Button Test:</strong> All events (lock, unlock, suspend, resume) will update the same row. Session ID is persistent per user and date.</div>
        <div className="mt-1"><strong>Note:</strong> Session ID only changes when you clear it manually or on a new day.</div>
      </div>
    </div>
  );
}
