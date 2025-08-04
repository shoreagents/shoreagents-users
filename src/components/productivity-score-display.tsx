'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Info, Target, BarChart3, RefreshCw } from 'lucide-react';

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

  const formatScore = (score: number | string): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (isNaN(numericScore)) return '0.0%';
    return `${numericScore.toFixed(1)}%`;
  };

  const formatHours = (hours: number | string): string => {
    const numericHours = typeof hours === 'string' ? parseFloat(hours) : hours;
    if (isNaN(numericHours)) return '0.0h';
    return `${numericHours.toFixed(1)}h`;
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
    if (numericScore >= 80) return 'text-green-600';
    if (numericScore >= 60) return 'text-yellow-600';
    if (numericScore >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number | string): "default" | "secondary" | "destructive" | "outline" => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numericScore >= 80) return 'default';
    if (numericScore >= 60) return 'secondary';
    if (numericScore >= 40) return 'outline';
    return 'destructive';
  };

  const getScoreLabel = (score: number | string): string => {
    const numericScore = typeof score === 'string' ? parseFloat(score) : score;
    if (numericScore >= 90) return 'Excellent';
    if (numericScore >= 80) return 'Great';
    if (numericScore >= 70) return 'Good';
    if (numericScore >= 60) return 'Fair';
    if (numericScore >= 50) return 'Average';
    if (numericScore >= 40) return 'Below Average';
    return 'Poor';
  };

  const fetchAllProductivityData = async () => {
    if (!currentUser?.email) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/activity/productivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_all',
          email: currentUser.email,
          monthsBack: 12
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setProductivityScores(data.productivityScores || []);
        setCurrentMonthScore(data.currentMonthScore);
        setAverageScore(data.averageProductivityScore);
        setLastUpdate(new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.error('Error fetching productivity data:', error);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    if (currentUser?.email) {
      // Single request to get all productivity data
      fetchAllProductivityData();
      
      // Auto-refresh every 5 seconds
      const interval = setInterval(() => {
        fetchAllProductivityData();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [currentUser?.email]);

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
                    <p className="text-sm">Based on active vs inactive time ratio</p>
                    <p className="text-sm">Current Month: {currentMonthScore ? formatScore(currentMonthScore.productivity_score) : 'N/A'}</p>
                    <p className="text-sm">Average: {formatScore(averageScore)}</p>
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
                <span>Loading productivity data...</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Current Month Score */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
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
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
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
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                    Recent History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {productivityScores.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {productivityScores.slice(0, 6).map((score, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-white/50 rounded">
                          <span className="text-sm font-medium">
                            {formatMonth(score.month_year)}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${getScoreColor(score.productivity_score)}`}>
                              {formatScore(score.productivity_score)}
                            </span>
                            <Badge variant="outline" size="sm">
                              {getScoreLabel(score.productivity_score)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
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