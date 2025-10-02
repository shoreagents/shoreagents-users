'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastApiUpdateRef = useRef<number>(0);

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
    if (isNaN(numericScore)) return 'text-gray-500';
    // Based on 40-hour work week (8h/day × 5 days × 4.33 weeks = ~173 max monthly points)
    if (numericScore >= 150) return 'text-purple-600';    // Legendary - 87%+
    if (numericScore >= 130) return 'text-green-600';     // Outstanding - 75%+
    if (numericScore >= 110) return 'text-blue-600';      // Excellent - 64%+
    if (numericScore >= 90) return 'text-cyan-600';       // Great - 52%+
    if (numericScore >= 70) return 'text-yellow-600';     // Good - 40%+
    if (numericScore >= 50) return 'text-orange-600';     // Fair - 29%+
    if (numericScore >= 30) return 'text-red-600';        // Poor - 17%+
    if (numericScore >= 10) return 'text-red-700';        // Very Poor - 6%+
    return 'text-red-800';                                 // Critical - <6%
  };

  const getScoreBadgeVariant = (score: number | string): "default" | "secondary" | "destructive" | "outline" => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    // Based on 40-hour work week (8h/day × 5 days × 4.33 weeks = ~173 max monthly points)
    if (numericScore >= 150) return 'default';    // Legendary - 87%+ (green)
    if (numericScore >= 130) return 'default';    // Outstanding - 75%+ (green)
    if (numericScore >= 110) return 'secondary';  // Excellent - 64%+ (blue)
    if (numericScore >= 90) return 'secondary';   // Great - 52%+ (cyan)
    if (numericScore >= 70) return 'outline';     // Good - 40%+ (yellow)
    if (numericScore >= 50) return 'outline';     // Fair - 29%+ (orange)
    return 'destructive';                         // Poor, Very Poor, Critical - red
  };

  const getScoreLabel = (score: number | string): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    // Based on 40-hour work week (8h/day × 5 days × 4.33 weeks = ~173 max monthly points)
    if (numericScore >= 150) return 'Legendary';      // 87%+ of max (150/173)
    if (numericScore >= 130) return 'Outstanding';    // 75%+ of max (130/173)
    if (numericScore >= 110) return 'Excellent';      // 64%+ of max (110/173)
    if (numericScore >= 90) return 'Great';           // 52%+ of max (90/173)
    if (numericScore >= 70) return 'Good';            // 40%+ of max (70/173)
    if (numericScore >= 50) return 'Fair';            // 29%+ of max (50/173)
    if (numericScore >= 30) return 'Poor';            // 17%+ of max (30/173)
    if (numericScore >= 10) return 'Very Poor';       // 6%+ of max (10/173)
    return 'Critical';                                 // <6% of max
  };

  // Function to update productivity score in real-time without HTTP requests
  const updateProductivityScoreRealtime = useCallback((activeSeconds: number, inactiveSeconds: number) => {
    // Clear any existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    // Debounce the update to prevent rapid successive changes
    updateTimeoutRef.current = setTimeout(() => {
      // Validate input data to prevent incorrect calculations
      if (typeof activeSeconds !== 'number' || typeof inactiveSeconds !== 'number' || 
          isNaN(activeSeconds) || isNaN(inactiveSeconds) || 
          activeSeconds < 0 || inactiveSeconds < 0) {
        console.warn('Invalid productivity data received:', { activeSeconds, inactiveSeconds });
        return;
      }
      
      // Don't update if we recently got fresh API data (within last 30 seconds)
      const timeSinceLastApiUpdate = Date.now() - lastApiUpdateRef.current;
      if (timeSinceLastApiUpdate < 30000) { // 30 seconds
        console.log('Skipping real-time update - recent API data available');
        return;
      }
      
      const activeHours = activeSeconds / 3600;
      const inactiveHours = inactiveSeconds / 3600;
      const productivityScore = activeHours - inactiveHours;
      
      // Only update if we have a valid current month score to work with
      setCurrentMonthScore((prev: any) => {
        if (!prev) {
          // If no previous data, don't update with potentially incomplete real-time data
          return prev;
        }
        
        // Only update if the new values are reasonable (not significantly different from previous)
        const prevActive = prev.total_active_seconds || 0;
        const prevInactive = prev.total_inactive_seconds || 0;
        
        // Check if the change is reasonable (within 10% or if it's the first update)
        const activeChange = Math.abs(activeSeconds - prevActive);
        const inactiveChange = Math.abs(inactiveSeconds - prevInactive);
        const maxReasonableChange = Math.max(prevActive, prevInactive) * 0.1; // 10% change
        
        // Only update if the change is reasonable or if this is the first real-time update
        if (activeChange <= maxReasonableChange && inactiveChange <= maxReasonableChange) {
          return {
            ...prev,
            productivity_score: productivityScore,
            total_active_seconds: activeSeconds,
            total_inactive_seconds: inactiveSeconds,
            active_hours: activeHours,
            inactive_hours: inactiveHours,
            total_hours: activeHours + inactiveHours,
            active_percentage: activeSeconds > 0 ? (activeSeconds / (activeSeconds + inactiveSeconds)) * 100 : 0
          };
        } else {
          // If the change is too large, don't update to prevent incorrect values
          console.warn('Productivity score change too large, skipping update:', {
            prevActive, prevInactive, activeSeconds, inactiveSeconds
          });
          return prev;
        }
      });
      
      // Dispatch custom event for leaderboard cache invalidation
      try {
        const event = new CustomEvent('productivity-update', {
          detail: {
            email: currentUser?.email,
            userId: currentUser?.id,
            productivityScore: productivityScore,
            totalActiveTime: activeSeconds,
            totalInactiveTime: inactiveSeconds,
            timestamp: new Date().toISOString()
          }
        });
        window.dispatchEvent(event);
      } catch (error) {
        console.error('Failed to dispatch productivity update event:', error);
      }
    }, 1000); // 1 second debounce
  }, [currentUser?.email, currentUser?.id]);

  const fetchAllProductivityDataRef = useRef(async () => {
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
        
        // Track when the last API update occurred
        lastApiUpdateRef.current = Date.now();
      }
    } catch (error) {
      console.error('Error fetching productivity data:', error);
    } finally {
      setLoading(false);
    }
  });

  // Update the ref when currentUser changes
  useEffect(() => {
    fetchAllProductivityDataRef.current = async () => {
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
        } else {
          console.error('API ERROR:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error fetching productivity data:', error);
      } finally {
        setLoading(false);
      }
    };
  }, [currentUser?.email, currentUser?.id]);

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
          
          // Dispatch custom event for leaderboard cache invalidation
          try {
            const event = new CustomEvent('productivity-update', {
              detail: {
                email: currentUser.email,
                userId: currentUser.id,
                productivityScore: data.productivityScore,
                totalActiveTime: data.totalActiveTime || 0,
                totalInactiveTime: data.totalInactiveTime || 0,
                timestamp: new Date().toISOString()
              }
            });
            window.dispatchEvent(event);
          } catch (error) {
            console.error('Failed to dispatch productivity update event:', error);
          }
        }
      }
    };

    // Listen for activity data changes (from database triggers)
    const handleActivityDataUpdate = (data: any) => {
      // Check if this update is for the current user
      if (data.user_id === currentUser.id && data.data) {
        
        // Update current month score in real-time without HTTP request
        const newActiveSeconds = data.data.today_active_seconds || 0;
        const newInactiveSeconds = data.data.today_inactive_seconds || 0;
        
        // Use the real-time update function instead of making HTTP requests
        updateProductivityScoreRealtime(newActiveSeconds, newInactiveSeconds);
      }
    };

    // Listen for general productivity updates
    socket.on('productivityScoreUpdated', handleProductivityUpdate);
    
    // Listen for activity data updates (from database triggers)
    socket.on('activity-data-updated', handleActivityDataUpdate);
    
    // Note: Removed circular event listener to prevent infinite loop

    // Request initial productivity data from server
    socket.emit('requestProductivityData', { 
      email: currentUser.email,
      userId: currentUser.id 
    });

    return () => {
      socket.off('productivityScoreUpdated', handleProductivityUpdate);
      socket.off('activity-data-updated', handleActivityDataUpdate);
    };
  }, [socket, isConnected, currentUser?.email, currentUser?.id, updateProductivityScoreRealtime]);

  // Initial data fetch
  useEffect(() => {
    if (currentUser?.email) {
      // Initial fetch of productivity data
      fetchAllProductivityDataRef.current();
      
      // Set up periodic refresh every 10 minutes as a fallback
      // This ensures data stays fresh even if WebSocket updates fail
      const interval = setInterval(() => {
        if (!isBreakActive && !isInMeeting) {
          fetchAllProductivityDataRef.current();
        }
      }, 600000); // 10 minutes
      
      return () => {
        clearInterval(interval);
        // Clean up any pending timeout
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
      };
    }
  }, [currentUser?.email, isBreakActive, isInMeeting]);


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
                    <p className="font-medium">Productivity Scoring (Monthly)</p>
                    <p className="text-sm">+1 point per hour active, -1 point per hour inactive</p>
                    <p className="text-sm">Final score = active points - inactive points</p>
                    <p className="text-sm">Max possible: ~173 points (8h/day × 5 days × 4.33 weeks)</p>
                    <p className="text-sm">Current Month: {currentMonthScore ? formatScore(currentMonthScore.productivity_score) : 'N/A'}</p>
                    <p className="text-sm">Average: {formatScore(averageScore)}</p>
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <p>Legendary: 150+ pts (87%+)</p>
                      <p>Outstanding: 130+ pts (75%+)</p>
                      <p>Excellent: 110+ pts (64%+)</p>
                    </div>
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