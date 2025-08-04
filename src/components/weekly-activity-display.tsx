'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Clock, TrendingUp, Info, RefreshCw } from 'lucide-react';

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
}

export default function WeeklyActivityDisplay({ currentUser }: WeeklyActivityDisplayProps) {
  const [weeklyData, setWeeklyData] = useState<WeeklyActivityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentWeek, setCurrentWeek] = useState<any>(null);
  const [cleanupStatus, setCleanupStatus] = useState<string>('');
  const [cleanupTime, setCleanupTime] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');

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

  const fetchAllWeeklyData = async () => {
    if (!currentUser?.email) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/activity/weekly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_all',
          email: currentUser.email,
          weeksToKeep: 1
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
  };



  useEffect(() => {
    if (currentUser?.email) {
      // Single request to get all weekly data
      fetchAllWeeklyData();
      
      // Auto-refresh every 5 seconds
      const interval = setInterval(() => {
        fetchAllWeeklyData();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser?.email]);

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
                    <p className="font-medium">Current Week Status</p>
                    <p className="text-sm">Active: {formatTime(currentWeekTotals.active)}</p>
                    <p className="text-sm">Inactive: {formatTime(currentWeekTotals.inactive)}</p>
                    <p className="text-sm">Week: {currentWeek?.weekStart ? formatDate(currentWeek.weekStart) : 'N/A'} - {currentWeek?.weekEnd ? formatDate(currentWeek.weekEnd) : 'N/A'}</p>
                    {cleanupStatus && <p className="text-sm text-green-600">{cleanupStatus}</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-refresh</span>
              {lastUpdate && <span>• Last: {lastUpdate}</span>}
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
            <div className="space-y-4">
              {weeklyData.map((week, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span className="font-medium text-blue-900">
                        {formatDate(week.week_start_date)} - {formatDate(week.week_end_date)}
                      </span>
                    </div>
                    <Badge variant="outline" className="border-blue-200 text-blue-700">
                      {week.total_days_active} days
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-lg font-bold text-green-600">
                        {formatTime(week.total_active_seconds)}
                      </div>
                      <div className="text-xs text-green-600">Active</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-red-600">
                        {formatTime(week.total_inactive_seconds)}
                      </div>
                      <div className="text-xs text-red-600">Inactive</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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