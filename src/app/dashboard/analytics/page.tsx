"use client"

import { useEffect, useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardSkeleton } from "@/components/skeleton-loaders"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, Award } from "lucide-react"
import { getCurrentUser } from "@/lib/ticket-utils"
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
  LineChart,
  Line,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts"

type WeeklyDay = { today_date: string; active_seconds: number; inactive_seconds: number }
type WeeklySummary = { week_start_date: string; week_end_date: string; total_active_seconds: number; total_inactive_seconds: number }
type MonthlySummary = { month_start_date: string; total_active_seconds: number; total_inactive_seconds: number }
type LeaderboardRow = { rank: number; name: string; productivityScore: number }
type ProductivityScore = { month_year: string; productivity_score: number }

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDay[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([])
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [leaderboardMonth, setLeaderboardMonth] = useState<string>('')
  const [prodScores, setProdScores] = useState<ProductivityScore[]>([])
  const [prodAverage, setProdAverage] = useState<number>(0)

  useEffect(() => {
    const load = async () => {
      try {
        const user = getCurrentUser()
        const email = user?.email
        const userId = user?.id
        if (!email) {
          setLoading(false); return
        }

        // Weekly
        const weeklyRes = await fetch('/api/activity/weekly', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_all', email, weeksToKeep: 2 })
        })
        if (weeklyRes.ok) {
          const data = await weeklyRes.json()
          setWeeklySummaries(data.weeklySummaries || [])
          setWeeklyDays((data.currentWeek || []).map((d: any) => ({
            today_date: d.today_date,
            active_seconds: d.active_seconds || 0,
            inactive_seconds: d.inactive_seconds || 0,
          })))
        }

        // Monthly
        const monthlyRes = await fetch('/api/activity/monthly', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_all', email, monthsToKeep: 12 })
        })
        if (monthlyRes.ok) {
          const data = await monthlyRes.json()
          setMonthlySummaries(data.monthlySummaries || [])
        }

        // Leaderboard (top 10)
        const lbRes = await fetch('/api/leaderboard?limit=10', { credentials: 'include' })
        if (lbRes.ok) {
          const data = await lbRes.json()
          setLeaderboard(data.leaderboard || [])
          setLeaderboardMonth(data.monthYear || '')
        }

        // Productivity
        const prodRes = await fetch('/api/activity/productivity', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_all', email, monthsBack: 12 })
        })
        if (prodRes.ok) {
          const data = await prodRes.json()
          setProdScores(data.productivityScores || [])
          setProdAverage(parseFloat(data.averageProductivityScore || 0))
        }
      } catch (e) {
        console.error('Analytics load error:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const weeklyDaySeries = useMemo(() => {
    return weeklyDays
      .slice()
      .sort((a, b) => new Date(a.today_date).getTime() - new Date(b.today_date).getTime())
      .map(d => ({
        date: new Date(d.today_date).toLocaleDateString('en-CA'),
        activeMin: Math.round((d.active_seconds || 0) / 60),
        inactiveMin: Math.round((d.inactive_seconds || 0) / 60),
      }))
  }, [weeklyDays])

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

  const top3 = useMemo(() => leaderboard.slice(0, 3), [leaderboard])
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

  const productivitySeries = useMemo(() => {
    return prodScores
      .slice()
      .reverse()
      .map(s => ({
        month: (() => { const [y, m] = s.month_year.split('-'); return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) })(),
        score: typeof s.productivity_score === 'string' ? parseFloat(s.productivity_score as any) : s.productivity_score,
      }))
  }, [prodScores])

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <DashboardSkeleton />
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
              <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
              <p className="text-muted-foreground">Deep dives into activity, productivity, and rankings</p>
            </div>
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

          {/* Top Performers (podium style) */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Top Performers</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Highlighting those who lead in activity and stay consistently engaged this month.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {top3.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground">No data</div>
              ) : (
                <div className="w-full flex justify-center">
                  <div className="flex items-end gap-10 py-4">
                  {top3.map((p, idx) => {
                    const score = Number(p.productivityScore || 0)
                    const height = Math.max(12, Math.round((score / podiumMax) * 140)) // 12-140px
                    const ringColor = idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : '#fb923c'
                    const barGradient = idx === 0 ? 'from-yellow-600/30 to-yellow-800/30' : idx === 1 ? 'from-slate-400/30 to-slate-600/30' : 'from-orange-500/30 to-orange-700/30'
                    return (
                      <div key={p.name + idx} className="flex flex-col items-center gap-2">
                        <div className="relative">
                          <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-semibold bg-card text-foreground"
                            style={{ border: `3px solid ${ringColor}` }}
                          >
                            {getInitials(p.name)}
                          </div>
                          <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-card text-foreground text-xs font-bold grid place-items-center" style={{ border: `2px solid ${ringColor}` }}>
                            {idx + 1}
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
              {formatMonthLabel && (
                <div className="pt-2 text-xs text-muted-foreground">{formatMonthLabel}</div>
              )}
            </CardContent>
          </Card>

          {/* Productivity Scores */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-4 w-4" />12-Month Average</CardTitle>
                <CardDescription>Your average productivity score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{Number(prodAverage).toFixed(1)}</div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Productivity History</CardTitle>
                <CardDescription>Monthly productivity points (last 12 months)</CardDescription>
              </CardHeader>
              <CardContent className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={productivitySeries} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
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
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}