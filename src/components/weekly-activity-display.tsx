'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Clock, TrendingUp, Info, RefreshCw } from 'lucide-react';
import { useTimer } from '@/contexts/timer-context';
import { useMeeting } from '@/contexts/meeting-context';
import { useSocket } from '@/contexts/socket-context';

interface WeeklyActivityData {
  week_start_date: string;
  week_end_date: string;
  total_active_seconds: number;
  total_inactive_seconds: number;
  total_days_active: number;
  total_hours_active: number;
  total_hours_inactive: number;
}

interface WeeklyActivityDisplayProps {
  currentUser: any;
  forceRefresh?: boolean;
}

export default function WeeklyActivityDisplay({ currentUser, forceRefresh = false }: WeeklyActivityDisplayProps) {
  const [weeklyData, setWeeklyData] = useState<WeeklyActivityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<any>(null);
  const [cleanupStatus, setCleanupStatus] = useState<string>('');
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Get break and meeting status to pause auto-refresh
  const { isBreakActive } = useTimer();
  const { isInMeeting } = useMeeting();
  const { socket, isConnected } = useSocket();

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric' 
    });
  };

  const fetchAllWeeklyData = useCallback(async (forceRefresh = false) => {
    if (!currentUser?.email) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/activity/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_all',
          email: currentUser.email,
          weeksToKeep: 1,
          forceRefresh
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWeeklyData(data.weeklySummaries || []);
        setCurrentWeek({
          currentWeek: data.currentWeek,
          weekStart: data.weekStart,
          weekEnd: data.weekEnd
        });
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Show cleanup status if records were deleted
        if (data.deletedRecords > 0) {
          setCleanupStatus(`Auto-cleanup: Deleted ${data.deletedRecords} old records`);
          setTimeout(() => setCleanupStatus(''), 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email]);

  // Function to update weekly data from real-time updates
  const updateWeeklyDataFromSocket = useCallback((socketData: any) => {
    if (!socketData || socketData.user_id !== currentUser?.id) return;
    
    setLastUpdate(new Date().toLocaleTimeString());
    
    // Show real-time update notification
    setCleanupStatus(`Real-time update: ${socketData.action} at ${new Date(socketData.timestamp).toLocaleTimeString()}`);
    setTimeout(() => setCleanupStatus(''), 3000);
    
    // Don't make API calls on every socket event - this causes excessive requests
    // Instead, just update the timestamp to show we received the update
    // The data will be fetched on the next user interaction or page refresh
  }, [currentUser?.id]);

  // Function to update monthly data from real-time updates
  const updateMonthlyDataFromSocket = useCallback((socketData: any) => {
    if (!socketData || socketData.user_id !== currentUser?.id) return;
    
    setLastUpdate(new Date().toLocaleTimeString());
    
    // Show real-time update notification
    setCleanupStatus(`Real-time update: ${socketData.action} at ${new Date(socketData.timestamp).toLocaleTimeString()}`);
    setTimeout(() => setCleanupStatus(''), 3000);
    
    // Don't make API calls on every socket event - this causes excessive requests
    // Instead, just update the timestamp to show we received the update
    // The data will be fetched on the next user interaction or page refresh
  }, [currentUser?.id]);

  // Silent fetch for real-time updates (no loading state)
  const fetchAllWeeklyDataSilently = useCallback(async () => {
    if (!currentUser?.email) return;
    
    try {
      const response = await fetch('/api/activity/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_all',
          email: currentUser.email,
          weeksToKeep: 1,
          forceRefresh: false
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWeeklyData(data.weeklySummaries || []);
        setCurrentWeek({
          currentWeek: data.currentWeek,
          weekStart: data.weekStart,
          weekEnd: data.weekEnd
        });
        
        // Show cleanup status if records were deleted
        if (data.deletedRecords > 0) {
          setCleanupStatus(`Auto-cleanup: Deleted ${data.deletedRecords} old records`);
          setTimeout(() => setCleanupStatus(''), 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching weekly data silently:', error);
    }
  }, [currentUser?.email]);

  useEffect(() => {
    if (currentUser?.email) {
      // Initial data fetch - no more 15-second polling needed!
      // Data now updates automatically via database triggers
      fetchAllWeeklyData();
    }
  }, [currentUser?.email, fetchAllWeeklyData]);

  // Effect to handle force refresh from parent component
  useEffect(() => {
    if (forceRefresh && currentUser?.email) {
      fetchAllWeeklyData(true);
    }
  }, [forceRefresh, currentUser?.email, fetchAllWeeklyData]);

  // Periodic refresh only when user is active and not in break/meeting
  useEffect(() => {
    if (!currentUser?.email || isBreakActive || isInMeeting) return;
    
    // Refresh data every 2 minutes (120 seconds) instead of every few seconds
    const interval = setInterval(() => {
      fetchAllWeeklyDataSilently();
    }, 120000); // 2 minutes
    
    return () => clearInterval(interval);
  }, [currentUser?.email, isBreakActive, isInMeeting, fetchAllWeeklyDataSilently]);

  // Refresh data when user returns to the tab
  useEffect(() => {
    const handleFocus = () => {
      if (currentUser?.email && !isBreakActive && !isInMeeting) {
        fetchAllWeeklyDataSilently();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser?.email, isBreakActive, isInMeeting, fetchAllWeeklyDataSilently]);

  // Listen for real-time weekly activity updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleWeeklyActivityUpdate = (data: any) => {
      updateWeeklyDataFromSocket(data);
    };

    const handleMonthlyActivityUpdate = (data: any) => {
      updateMonthlyDataFromSocket(data);
    };

    // Listen for real-time updates
    socket.on('weekly-activity-update', handleWeeklyActivityUpdate);
    socket.on('monthly-activity-update', handleMonthlyActivityUpdate);

    // Cleanup listeners
    return () => {
      socket.off('weekly-activity-update', handleWeeklyActivityUpdate);
      socket.off('monthly-activity-update', handleMonthlyActivityUpdate);
    };
  }, [socket, isConnected, currentUser?.id, updateWeeklyDataFromSocket, updateMonthlyDataFromSocket]);

  // Calculate current week totals
  const currentWeekTotals = currentWeek?.currentWeek?.reduce((acc: any, day: any) => {
    acc.active += day.active_seconds || 0;
    acc.inactive += day.inactive_seconds || 0;
    return acc;
  }, { active: 0, inactive: 0 }) || { active: 0, inactive: 0 };

  return (
    <div className="space-y-6">
      {/* Weekly Activity History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Weekly Activity History
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <p className="text-sm">Week: {currentWeek?.weekStart ? formatDate(currentWeek.weekStart) : 'N/A'} - {currentWeek?.weekEnd ? formatDate(currentWeek.weekEnd) : 'N/A'}</p>
                    <p className="text-sm">Last Update: {lastUpdate}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => fetchAllWeeklyData(true)}
                disabled={loading}
                className="h-8 px-2 hover:!bg-transparent dark:hover:text-white hover:text-black "
                title="Refresh weekly data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading weekly data...</span>
              </div>
            </div>
          ) : weeklyData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Week Period</TableHead>
                  <TableHead className="w-[100px]">Days Active</TableHead>
                  <TableHead className="w-[120px]">Active Time</TableHead>
                  <TableHead className="w-[120px]">Inactive Time</TableHead>
                  <TableHead className="w-[120px]">Total Time</TableHead>
                  <TableHead className="w-[100px]">Productivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklyData.slice(0, 6).map((week, index) => {
                  const totalSeconds = week.total_active_seconds + week.total_inactive_seconds;
                  const productivityScore = (week.total_active_seconds / 3600) - (week.total_inactive_seconds / 3600);
                  
                  return (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 " />
                          <div>
                            <div className="font-medium text-sm">
                              {formatDate(week.week_start_date)} - {formatDate(week.week_end_date)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-none">
                          {week.total_days_active} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-green-600">
                          {formatTime(week.total_active_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-red-600">
                          {formatTime(week.total_inactive_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {formatTime(totalSeconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-purple-600">
                          {Math.max(0, productivityScore).toFixed(1)} pts
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No weekly activity data available</p>
              <p className="text-sm">Activity data will appear here after a week of tracking</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 