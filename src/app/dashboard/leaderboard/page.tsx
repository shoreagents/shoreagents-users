"use client"

import { useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { LeaderboardSkeleton } from "@/components/skeleton-loaders"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, Target, Award } from "lucide-react"
import { useAnalyticsData } from "@/hooks/use-analytics"
import { ProductivityPieChart } from "@/components/charts/productivity-pie-chart"
import { 
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts"

export default function LeaderboardPage() {
  // Filter state for Top Performers
  const [topPerformersFilter, setTopPerformersFilter] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  
  // Filter state for Productivity History
  const [productivityYearFilter, setProductivityYearFilter] = useState<number>(new Date().getFullYear())

  // Use React Query hooks for all analytics data
  const {
    weeklySummaries,
    monthlySummaries,
    leaderboard,
    leaderboardMonth,
    todayDate,
    prodScores,
    prodAverage,
    isLoading,
  } = useAnalyticsData(topPerformersFilter)

  // Get current week date range for display
  const currentWeekRange = useMemo(() => {
    if (topPerformersFilter === 'weekly' && weeklySummaries.length > 0) {
      const currentWeek = weeklySummaries[0] // Most recent week
      if (currentWeek.week_start_date && currentWeek.week_end_date) {
        const startDate = new Date(currentWeek.week_start_date)
        const endDate = new Date(currentWeek.week_end_date)
        return {
          start: startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          end: endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        }
      }
    }
    return null
  }, [topPerformersFilter, weeklySummaries])

  // Get current month for display
  const currentMonth = useMemo(() => {
    if (topPerformersFilter === 'monthly' && prodScores.length > 0) {
      const currentMonthData = prodScores[0] // Most recent month
      if (currentMonthData.month_year) {
        const [year, month] = currentMonthData.month_year.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1, 1)
        return date.toLocaleDateString('en-US', { 
          month: 'long', 
          year: 'numeric' 
        })
      }
    }
    return null
  }, [topPerformersFilter, prodScores])

  const monthlySeries = useMemo(() => {
    return monthlySummaries
      .slice()
      .reverse()
      .map(m => ({
        month: new Date(m.month_start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        activeHrs: Math.round(((m.total_active_seconds || 0) / 3600) * 10) / 10,
        inactiveHrs: Math.round(((m.total_inactive_seconds || 0) / 3600) * 10) / 10,
      }))
  }, [monthlySummaries])

  // Transform productivity scores for pie chart
  const pieChartData = useMemo(() => {
    return prodScores.map((score) => {
      const date = new Date(score.month_year + '-01') // Add day to make it a valid date
      return {
        month: date.toLocaleDateString('en-US', { month: 'long' }).toLowerCase(),
        score: parseFloat(score.productivity_score.toString()),
        monthName: date.toLocaleDateString('en-US', { month: 'short' }),
      }
    }).sort((a, b) => {
      // Sort by month order
      const monthOrder = ['january', 'february', 'march', 'april', 'may', 'june', 
                         'july', 'august', 'september', 'october', 'november', 'december']
      return monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)
    })
  }, [prodScores])

  const weeklySummarySeries = useMemo(() => {
    return weeklySummaries
      .slice(0, 6)
      .reverse()
      .map(w => {
        const start = new Date(w.week_start_date)
        const end = new Date(w.week_end_date)
        const label = `${start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}`
        return {
          week: label,
          activeHrs: Math.round(((w.total_active_seconds || 0) / 3600) * 10) / 10,
          inactiveHrs: Math.round(((w.total_inactive_seconds || 0) / 3600) * 10) / 10,
        }
      })
  }, [weeklySummaries])

  const leaderboardSeries = useMemo(() => {
    const top = leaderboard.slice(0, 5)
    const maxScore = Math.max(1, ...top.map(r => Number(r.productivityScore || 0)))
    return {
      data: top.map(r => ({ name: r.name || `User ${r.rank}`.trim(), score: Number(r.productivityScore || 0) })),
      maxScore,
    }
  }, [leaderboard])

  const top3 = useMemo(() => {
    const firstThree = leaderboard.slice(0, 3)
    // Reorder to put #1 in the center: [2nd, 1st, 3rd]
    if (firstThree.length >= 3) {
      return [firstThree[1], firstThree[0], firstThree[2]]
    } else if (firstThree.length === 2) {
      return [firstThree[1], firstThree[0]]
    }
    return firstThree
  }, [leaderboard])
  const podiumMax = useMemo(() => Math.max(1, ...top3.map(p => Number(p.productivityScore || 0))), [top3])
  const formatMonthLabel = useMemo(() => {
    if (!leaderboardMonth) return ''
    const [y, m] = leaderboardMonth.split('-')
    const d = new Date(parseInt(y), parseInt(m) - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [leaderboardMonth])
  const getInitials = (name: string) => {
    if (!name) return 'NA'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return ''
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) // Returns format like "Oct 10 2025"
    } catch {
      return dateString
    }
  }

  const productivitySeries = useMemo(() => {
    return prodScores
      .slice()
      .reverse()
      .map(s => ({
        month: (() => { const [y, m] = s.month_year.split('-'); return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })(),
        score: typeof s.productivity_score === 'string' ? parseFloat(s.productivity_score as any) : s.productivity_score,
        year: parseInt(s.month_year.split('-')[0]),
      }))
  }, [prodScores])

  const filteredProductivitySeries = useMemo(() => {
    const filtered = productivitySeries.filter(item => item.year === productivityYearFilter)
    
    // If no data for selected year, create empty months for that year
    if (filtered.length === 0) {
      const months = []
      for (let month = 0; month < 12; month++) {
        const date = new Date(productivityYearFilter, month, 1)
        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          score: 0,
          year: productivityYearFilter
        })
      }
      return months
    }
    
    return filtered
  }, [productivitySeries, productivityYearFilter])

  // Get available years from the data + add historical years
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const dataYears = [...new Set(prodScores.map(s => parseInt(s.month_year.split('-')[0])))].sort((a, b) => b - a)
    
    // Add years from 2020 to current year + 1
    const allYears = []
    for (let year = currentYear + 1; year >= 2020; year--) {
      allYears.push(year)
    }
    
    // Combine data years with historical years, removing duplicates
    const combinedYears = [...new Set([...dataYears, ...allYears])].sort((a, b) => b - a)
    
    return combinedYears
  }, [prodScores])

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <LeaderboardSkeleton />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
              <p className="text-muted-foreground">Deep dives into activity, productivity, and rankings</p>
            </div>
          </div>

          {/* Top Performers */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Highlighting those who lead in activity and stay consistently engaged {topPerformersFilter === 'daily' ? 'today' : topPerformersFilter === 'weekly' ? 'this week' : 'this month'}.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  {topPerformersFilter === 'daily' && todayDate && (
                    <div className="text-sm font-medium text-foreground">
                      {formatDisplayDate(todayDate)}
                    </div>
                  )}
                  {topPerformersFilter === 'weekly' && currentWeekRange && (
                    <div className="text-sm font-medium text-foreground">
                      {currentWeekRange.start} - {currentWeekRange.end}
                    </div>
                  )}
                  {topPerformersFilter === 'monthly' && currentMonth && (
                    <div className="text-sm font-medium text-foreground">
                      {currentMonth}
                    </div>
                  )}
                  <Tabs value={topPerformersFilter} onValueChange={(value) => setTopPerformersFilter(value as 'daily' | 'weekly' | 'monthly')}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="daily">Daily</TabsTrigger>
                      <TabsTrigger value="weekly">Weekly</TabsTrigger>
                      <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                {/* Team Members Table */}
                <div className="flex-1">
                  <ScrollArea className="h-80">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Rank</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead className="text-right">Points</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaderboard.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground">
                              No data available
                            </TableCell>
                          </TableRow>
                        ) : (
                          leaderboard.map((member, index) => (
                            <TableRow key={member.userId} className={index < 3 ? "bg-muted/50" : ""}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {index === 0 && <Award className="h-4 w-4 text-yellow-500" />}
                                  {index === 1 && <Award className="h-4 w-4 text-gray-400" />}
                                  {index === 2 && <Award className="h-4 w-4 text-orange-500" />}
                                  {index + 1}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={member.profilePicture} alt={member.name} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(member.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{member.name}</div>
                                    <div className="text-sm text-muted-foreground">{member.userId}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {member.productivityScore.toFixed(1)} pts
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                  {formatMonthLabel && (
                    <div className="pt-2 text-xs text-muted-foreground">{formatMonthLabel}</div>
                  )}
                </div>

                <div className="hidden lg:flex items-center">
                  <Separator orientation="vertical" className="h-80" />
                </div>

                {/* Top Performers Podium */}
                <div className="flex-1">
                  {top3.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-muted-foreground">No data</div>
                  ) : (
                    <div className="w-full flex justify-center">
                      <div className="flex items-end gap-10 py-4">
                  {top3.map((p, idx) => {
                    const score = Number(p.productivityScore || 0)
                    const height = Math.max(12, Math.round((score / podiumMax) * 140)) // 12-140px
                    
                    // Determine actual rank based on position in reordered array
                    let actualRank
                    if (top3.length >= 3) {
                      // [2nd, 1st, 3rd] -> actual ranks are [2, 1, 3]
                      actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3
                    } else if (top3.length === 2) {
                      // [2nd, 1st] -> actual ranks are [2, 1]
                      actualRank = idx === 0 ? 2 : 1
                    } else {
                      actualRank = idx + 1
                    }
                    
                    const ringColor = actualRank === 1 ? '#f59e0b' : actualRank === 2 ? '#94a3b8' : '#fb923c'
                    const barGradient = actualRank === 1 ? 'from-yellow-600/30 to-yellow-800/30' : actualRank === 2 ? 'from-slate-400/30 to-slate-600/30' : 'from-orange-500/30 to-orange-700/30'
                    return (
                      <div key={p.name + idx} className="flex flex-col items-center gap-2">
                        <div className="relative">
                          <Avatar
                            className="w-14 h-14"
                            style={{ border: `3px solid ${ringColor}` }}
                          >
                            <AvatarImage src={p.profilePicture} alt={p.name} />
                            <AvatarFallback className="text-sm font-semibold bg-card text-foreground">
                              {getInitials(p.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-card text-foreground text-xs font-bold grid place-items-center" style={{ border: `2px solid ${ringColor}` }}>
                            {actualRank}
                          </span>
                        </div>
                        <div className={`w-24 rounded-t-md bg-gradient-to-b ${barGradient}`} style={{ height }}></div>
                        <div className="text-center">
                          <p className="text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">Points: {score.toLocaleString()}</p>
                        </div>
                    </div>
                    )
                  })}
                  </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Productivity Scores */}
          <div className="grid gap-4 md:grid-cols-3">
            <ProductivityPieChart 
              monthlyData={pieChartData}
              averageScore={prodAverage}
              isLoading={isLoading}
            />

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Productivity History</CardTitle>
                    <CardDescription>Monthly productivity points by year</CardDescription>
                  </div>
                  <Select value={productivityYearFilter.toString()} onValueChange={(value) => setProductivityYearFilter(parseInt(value))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableYears.map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredProductivitySeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip 
                      contentStyle={{ background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Area type="monotone" dataKey="score" stroke="hsl(var(--chart-2))" fill="url(#prodGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Weekly and Monthly Activity in 2-column grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Weekly Activity (use same weekly summary data as activity page) */}
            <Card>
              <CardHeader>
                <CardTitle>Weekly Activity</CardTitle>
                <CardDescription>Active vs inactive hours per week</CardDescription>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklySummarySeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ReTooltip 
                      contentStyle={{ background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Bar dataKey="activeHrs" name="Active (hrs)" fill="hsl(var(--chart-1))" radius={[3,3,0,0]} />
                    <Bar dataKey="inactiveHrs" name="Inactive (hrs)" fill="hsl(var(--chart-5))" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Monthly Activity (compact stacked bars) */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Activity</CardTitle>
                <CardDescription>Active vs inactive hours per month</CardDescription>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlySeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <ReTooltip 
                      contentStyle={{ background: 'hsl(var(--card))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Bar dataKey="activeHrs" name="Active (hrs)" stackId="a" fill="hsl(var(--chart-2))" radius={[3,3,0,0]} />
                    <Bar dataKey="inactiveHrs" name="Inactive (hrs)" stackId="a" fill="hsl(var(--chart-5))" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 