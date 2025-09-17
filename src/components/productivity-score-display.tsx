'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Info, Target, BarChart3, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTimer } from '@/contexts/timer-context';
import { useMeeting } from '@/contexts/meeting-context';
import { useSocket } from '@/contexts/socket-context';

interface ProductivityScore {
  month_year: string;
  productivity_score: number | string;
  total_active_seconds: number;
  total_inactive_seconds: number;
  total_seconds: number;
  active_percentage: number;
  active_hours: number | string;
  inactive_hours: number | string;
  total_hours: number | string;
}

interface ProductivityScoreDisplayProps {
  currentUser: any;
}

export default function ProductivityScoreDisplay({ currentUser }: ProductivityScoreDisplayProps) {
  const [productivityScores, setProductivityScores] = useState<ProductivityScore[]>([]);
  const [currentMonthScore, setCurrentMonthScore] = useState<any>(null);
  const [averageScore, setAverageScore] = useState<number | string>(0);
  const [loading, setLoading] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Get break and meeting status to pause auto-refresh
  const { isBreakActive } = useTimer();
  const { isInMeeting } = useMeeting();
  
  // Get socket connection for real-time updates
  const { socket, isConnected } = useSocket();

  const formatScore = (score: number | string): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(numericScore)) return '0.0 pts';
    return `${numericScore.toFixed(1)} pts`;
  };

  const formatHours = (hours: number | string): string => {
    const numericHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    if (isNaN(numericHours)) return '0h 0m';
    
    const totalMinutes = Math.round(numericHours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const formatMonth = (monthYear: string): string => {
    const [year, month] = monthYear.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const getScoreColor = (score: number | string): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(numericScore)) return '0.0 pts';
    if (numericScore >= 8) return 'text-green-600';
    if (numericScore >= 6) return 'text-blue-600';
    if (numericScore >= 4) return 'text-yellow-600';
    if (numericScore >= 2) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number | string): "default" | "secondary" | "destructive" | "outline" => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numericScore >= 8) return 'default';
    if (numericScore >= 6) return 'secondary';
    if (numericScore >= 4) return 'outline';
    return 'destructive';
  };

  const getScoreLabel = (score: number | string): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numericScore >= 10) return 'Outstanding';
    if (numericScore >= 8) return 'Excellent';
    if (numericScore >= 6) return 'Great';
    if (numericScore >= 4) return 'Good';
    if (numericScore >= 2) return 'Fair';
    if (numericScore >= 1) return 'Poor';
    return 'Very Poor';
  };

  const fetchAllProductivityData = useCallback(async () => {
    if (!currentUser?.email) return;
    
    setLoading(true);
    try {
      const requestBody = {
        action: 'get_all',
        email: currentUser.email,
        monthsBack: 12
      };
      
      const response = await fetch('/api/activity/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (response.ok) {
        const data = await response.json();
        setProductivityScores(data.productivityScores || []);
        setCurrentMonthScore(data.currentMonthScore);
        setAverageScore(data.averageProductivityScore);
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Emit productivity update to socket server for real-time leaderboard updates
        if (data.currentMonthScore) {
          try {
            const event = new CustomEvent('productivity-update', {
              detail: {
                email: currentUser.email,
                userId: currentUser.id,
                productivityScore: data.currentMonthScore.productivity_score,
                totalActiveTime: data.currentMonthScore.total_active_seconds || 0,
                totalInactiveTime: data.currentMonthScore.total_inactive_seconds || 0,
                timestamp: new Date().toISOString()
              }
            });
            window.dispatchEvent(event);
          } catch (error) {
            console.error('Socket productivity update failed:', error);
          }
        }
      } else {
        console.error('API ERROR:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching productivity data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.email, currentUser?.id]);

  // Manual refresh function
  const handleManualRefresh = () => {
    fetchAllProductivityData();
  };

  // Set up real-time productivity score updates via WebSocket
  useEffect(() => {
    if (!socket || !isConnected || !currentUser?.email) return;

    // Listen for productivity score updates from the server
    const handleProductivityUpdate = (data: any) => {
      // Check if this update is for the current user
      if (data.userId === currentUser.id || data.email === currentUser.email) {
        // Update the current month score with new data
        if (data.productivityScore !== undefined) {
          setCurrentMonthScore((prev: any) => ({
            ...prev,
            productivity_score: data.productivityScore,
            total_active_seconds: data.totalActiveTime || prev?.total_active_seconds,
            total_inactive_seconds: data.totalInactiveTime || prev?.total_inactive_seconds,
            active_hours: (data.totalActiveTime || 0) / 3600,
            inactive_hours: (data.totalInactiveTime || 0) / 3600,
            total_hours: ((data.totalActiveTime || 0) + (data.totalInactiveTime || 0)) / 3600
          }));
          
          // Update the last update timestamp
          setLastUpdate(new Date().toLocaleTimeString());
        }
      }
    };

    // Listen for general productivity updates
    socket.on('productivityScoreUpdated', handleProductivityUpdate);
    
    // Also listen for the custom event we dispatch
    const handleCustomProductivityUpdate = (event: CustomEvent) => {
      handleProductivityUpdate(event.detail);
    };
    
    window.addEventListener('productivity-update', handleCustomProductivityUpdate as EventListener);

    // Request initial productivity data from server
    socket.emit('requestProductivityData', { 
      email: currentUser.email,
      userId: currentUser.id 
    });

    return () => {
      socket.off('productivityScoreUpdated', handleProductivityUpdate);
      window.removeEventListener('productivity-update', handleCustomProductivityUpdate as EventListener);
    };
  }, [socket, isConnected, currentUser?.email, currentUser?.id]);

  // Initial data fetch
  useEffect(() => {
    if (currentUser?.email) {
      // Initial fetch of productivity data
      fetchAllProductivityData();
      
      // Set up periodic refresh every 2 minutes as a fallback
      // This ensures data stays fresh even if WebSocket updates fail
      const interval = setInterval(() => {
        if (!isBreakActive && !isInMeeting) {
          fetchAllProductivityData();
        }
      }, 120000); // 2 minutes
      
      return () => clearInterval(interval);
    }
  }, [currentUser?.email, isBreakActive, isInMeeting, fetchAllProductivityData]);

  return (
    <div className="space-y-6">
      {/* Productivity Score Dashboard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Productivity Score Dashboard
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="space-y-2">
                    <p className="font-medium">Productivity Scoring</p>
                    <p className="text-sm">+1 point per hour active, -1 point per hour inactive</p>
                    <p className="text-sm">Final score = active points - inactive points</p>
                    <p className="text-sm">Current Month: {currentMonthScore ? formatScore(currentMonthScore.productivity_score) : 'N/A'}</p>
                    <p className="text-sm">Average: {formatScore(averageScore)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex items-center gap-3">
              {/* Real-time status indicator - only dot */}
              <div className="flex items-center gap-1 text-xs">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Loading productivity data...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Month Score */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-green-200 dark:border-emerald-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-green-600" />
                    Current Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {currentMonthScore ? (
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className={`text-3xl font-bold ${getScoreColor(currentMonthScore.productivity_score)}`}>
                          {formatScore(currentMonthScore.productivity_score)}
                        </div>
                        <Badge 
                          variant={getScoreBadgeVariant(currentMonthScore.productivity_score)}
                          className="mt-2"
                        >
                          {getScoreLabel(currentMonthScore.productivity_score)}
                        </Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Active:</span>
                          <span className="font-medium">{formatHours(currentMonthScore.active_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Inactive:</span>
                          <span className="font-medium">{formatHours(currentMonthScore.inactive_hours)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-medium">{formatHours(currentMonthScore.total_hours)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No current month data</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Average Score */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-indigo-950/20 dark:to-indigo-900/10 border-blue-200 dark:border-indigo-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    12-Month Average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(averageScore)}`}>
                        {formatScore(averageScore)}
                      </div>
                      <Badge 
                        variant={getScoreBadgeVariant(averageScore)}
                        className="mt-2"
                      >
                        {getScoreLabel(averageScore)}
                      </Badge>
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      <p>Based on last 12 months</p>
                      <p>of productivity data</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Score History */}
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/10 border-purple-200 dark:border-violet-900/40">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Recent History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {productivityScores.length > 0 ? (
                    <ScrollArea className="h-40 pr-3">
                      <div className="space-y-2">
                        {productivityScores.slice(0, 6).map((score, index) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded border border-border/50 bg-muted/40 dark:bg-muted/20">
                            <span className="text-sm font-medium">
                              {formatMonth(score.month_year)}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold ${getScoreColor(score.productivity_score)}`}>
                                {formatScore(score.productivity_score)}
                              </span>
                              <Badge variant="outline">
                                {getScoreLabel(score.productivity_score)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No history available</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 