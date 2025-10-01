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

interface MonthlyActivityData {
  month_start_date: string;
  month_end_date: string;
  total_active_seconds: number;
  total_inactive_seconds: number;
  total_days_active: number;
  total_hours_active: number;
  total_hours_inactive: number;
}

interface MonthlyActivityDisplayProps {
  currentUser: any;
}

export default function MonthlyActivityDisplay({ currentUser }: MonthlyActivityDisplayProps) {
  const [monthlyData, setMonthlyData] = useState<MonthlyActivityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<any>(null);
  const [cleanupStatus, setCleanupStatus] = useState<string>('');
  const [cleanupTime, setCleanupTime] = useState<number>(0);
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
      month: 'long', 
      year: 'numeric' 
    });
  };

  const fetchAllMonthlyData = useCallback(async () => {
    if (!currentUser?.email) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/activity/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_all',
          email: currentUser.email,
          monthsToKeep: 1
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMonthlyData(data.monthlySummaries || []);
        setCurrentMonth({
          currentMonth: data.currentMonth,
          monthStart: data.monthStart,
          monthEnd: data.monthEnd
        });
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Show cleanup status if records were deleted
        if (data.deletedRecords > 0) {
          setCleanupStatus(`Auto-cleanup: Deleted ${data.deletedRecords} old records`);
          setTimeout(() => setCleanupStatus(''), 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching monthly data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email]);

  // Silent fetch for real-time updates (no loading state)
  const fetchAllMonthlyDataSilently = useCallback(async () => {
    if (!currentUser?.email) return;
    
    try {
      const response = await fetch('/api/activity/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_all',
          email: currentUser.email,
          monthsToKeep: 1
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMonthlyData(data.monthlySummaries || []);
        setCurrentMonth({
          currentMonth: data.currentMonth,
          monthStart: data.monthStart,
          monthEnd: data.monthEnd
        });
        
        // Show cleanup status if records were deleted
        if (data.deletedRecords > 0) {
          setCleanupStatus(`Auto-cleanup: Deleted ${data.deletedRecords} old records`);
          setTimeout(() => setCleanupStatus(''), 3000);
        }
      }
    } catch (error) {
      console.error('Error fetching monthly data silently:', error);
    }
  }, [currentUser?.email]);

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

  useEffect(() => {
    if (currentUser?.email) {
      // Initial data fetch - no more 15-second polling needed!
      // Data now updates automatically via database triggers
      fetchAllMonthlyData();
    }
  }, [currentUser?.email, fetchAllMonthlyData]);

  // Periodic refresh only when user is active and not in break/meeting
  useEffect(() => {
    if (!currentUser?.email || isBreakActive || isInMeeting) return;
    
    // Refresh data every 2 minutes (120 seconds) instead of every few seconds
    const interval = setInterval(() => {
      fetchAllMonthlyDataSilently();
    }, 120000); // 2 minutes
    
    return () => clearInterval(interval);
  }, [currentUser?.email, isBreakActive, isInMeeting, fetchAllMonthlyDataSilently]);

  // Refresh data when user returns to the tab
  useEffect(() => {
    const handleFocus = () => {
      if (currentUser?.email && !isBreakActive && !isInMeeting) {
        fetchAllMonthlyDataSilently();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser?.email, isBreakActive, isInMeeting, fetchAllMonthlyDataSilently]);

  // Listen for real-time monthly activity updates
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleMonthlyActivityUpdate = (data: any) => {
      updateMonthlyDataFromSocket(data);
    };

    const handleWeeklyActivityUpdate = (data: any) => {
      updateWeeklyDataFromSocket(data);
    };

    // Listen for real-time updates
    socket.on('monthly-activity-update', handleMonthlyActivityUpdate);
    socket.on('weekly-activity-update', handleWeeklyActivityUpdate);

    // Cleanup listeners
    return () => {
      socket.off('monthly-activity-update', handleMonthlyActivityUpdate);
      socket.off('weekly-activity-update', handleWeeklyActivityUpdate);
    };
  }, [socket, isConnected, currentUser?.id, updateMonthlyDataFromSocket, updateWeeklyDataFromSocket]);

  // Calculate current month totals
  const currentMonthTotals = currentMonth?.currentMonth?.reduce((acc: any, day: any) => {
    acc.active += day.active_seconds || 0;
    acc.inactive += day.inactive_seconds || 0;
    return acc;
  }, { active: 0, inactive: 0 }) || { active: 0, inactive: 0 };

  return (
    <div className="space-y-6">
      {/* Monthly Activity History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Monthly Activity History
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <p className="text-sm">Month: {currentMonth?.monthStart ? formatDate(currentMonth.monthStart) : 'N/A'}</p>
                    <p className="text-sm ">Last Update: {lastUpdate}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchAllMonthlyData}
                disabled={loading}
                className="h-8 px-2 hover:!bg-transparent dark:hover:text-white hover:text-black "
                title="Refresh monthly data"
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
                <span>Loading monthly data...</span>
              </div>
            </div>
          ) : monthlyData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Month</TableHead>
                  <TableHead className="w-[100px]">Days Active</TableHead>
                  <TableHead className="w-[120px]">Active Time</TableHead>
                  <TableHead className="w-[120px]">Inactive Time</TableHead>
                  <TableHead className="w-[120px]">Total Time</TableHead>
                  <TableHead className="w-[100px]">Productivity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyData.slice(0, 6).map((month, index) => {
                  const totalSeconds = month.total_active_seconds + month.total_inactive_seconds;
                  const productivityScore = (month.total_active_seconds / 3600) - (month.total_inactive_seconds / 3600);
                  
                  return (
                    <TableRow key={index} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <div>
                            <div className="font-medium text-sm">
                              {formatDate(month.month_start_date)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-none">
                          {month.total_days_active} days
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-green-600">
                          {formatTime(month.total_active_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-red-600">
                          {formatTime(month.total_inactive_seconds)}
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
              <p>No monthly activity data available</p>
              <p className="text-sm">Activity data will appear here after a month of tracking</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 