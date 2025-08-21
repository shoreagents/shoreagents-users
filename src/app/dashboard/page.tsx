"use client"

import { useMemo, useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardSkeleton } from "@/components/skeleton-loaders"
import { ShiftResetTimer } from "@/components/shift-reset-timer"
import { useActivityTracker } from "@/hooks/use-activity-tracker"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus,
  Calendar,
  Tag,
  Eye
} from "lucide-react"
import Link from "next/link"
import { Ticket, getCurrentUser } from "@/lib/ticket-utils"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts"

type BreakSession = {
  id: number
  break_type: string
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  break_date: string
}

type MeetingItem = any

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([])
  const [allTickets, setAllTickets] = useState<Ticket[]>([])
  const [breaks, setBreaks] = useState<BreakSession[]>([])
  const [meetings, setMeetings] = useState<MeetingItem[]>([])
  
  // Track user activity to prevent away status
  useActivityTracker()

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const currentUser = getCurrentUser()
        const userId = currentUser?.id
        // Tickets
        const ticketsRes = await fetch('/api/tickets', { credentials: 'include' })
        if (ticketsRes.ok) {
          const data = await ticketsRes.json()
          const tickets = (data?.tickets || []) as Ticket[]
          setAllTickets(tickets)
          const sorted = [...tickets].sort((a, b) => {
            const aTs = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime()
            const bTs = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime()
            return bTs - aTs
          })
          setRecentTickets(sorted.slice(0, 5))
        }

        // Break history - last 7 days
        if (userId) {
          const breaksRes = await fetch(`/api/breaks/history?agent_user_id=${encodeURIComponent(userId)}&days=7&include_active=true`, { credentials: 'include' })
          if (breaksRes.ok) {
            const data = await breaksRes.json()
            setBreaks([...(data?.data?.completed_breaks || []), ...(data?.data?.active_breaks || [])])
          }
          // Meeting history - last 7 days
          const meetingsRes = await fetch(`/api/meetings?agent_user_id=${encodeURIComponent(userId)}&days=7`, { credentials: 'include' })
          if (meetingsRes.ok) {
            const data = await meetingsRes.json()
            setMeetings(data?.meetings || [])
          }
        }
      } catch (err) {
        console.error('Error loading dashboard:', err)
      } finally {
        setLoading(false)
      }
    }
    loadDashboard()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  const statusCounts = useMemo(() => {
    return allTickets.reduce<Record<string, number>>((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1
      return acc
    }, {})
  }, [allTickets])

  const getStatusCount = (status: string) => statusCounts[status] || 0

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'For Approval':
        return <Badge variant="outline" className="border-[hsl(var(--chart-2))] text-[hsl(var(--chart-2))] bg-[hsl(var(--chart-4))]">For Approval</Badge>
      case 'On Hold':
        return <Badge variant="destructive" className="text-white">On Hold</Badge>
      case 'In Progress':
        return <Badge variant="default" className="bg-[hsl(var(--chart-1))] text-white">In Progress</Badge>
      case 'Approved':
        return <Badge variant="outline" className="border-[hsl(var(--chart-1))] text-[hsl(var(--chart-1))] bg-[hsl(var(--chart-4))]">Approved</Badge>
      case 'Stuck':
        return <Badge variant="destructive" className="text-white">Stuck</Badge>
      case 'Actioned':
        return <Badge variant="outline" className="border-[hsl(var(--chart-2))] text-[hsl(var(--chart-2))] bg-[hsl(var(--chart-4))]">Actioned</Badge>
      case 'Closed':
        return <Badge variant="outline" className="border-[hsl(var(--chart-3))] text-[hsl(var(--chart-3))] bg-[hsl(var(--chart-4))]">Closed</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Build 7-day series for breaks using only break_date and duration_minutes
  const breakSeries = useMemo(() => {
    const map = new Map<string, number>()
    breaks.forEach((s) => {
      const dateKey = s.break_date ? new Date(s.break_date as any).toLocaleDateString('en-CA') : new Date(s.start_time).toLocaleDateString('en-CA')
      const raw = s.duration_minutes as any
      const minutes = typeof raw === 'string' ? parseFloat(raw) : raw
      if (!Number.isFinite(minutes) || minutes <= 0) return
      map.set(dateKey, (map.get(dateKey) || 0) + minutes)
    })
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toLocaleDateString('en-CA'))
    }
    return days.map((d) => ({ date: d, minutes: map.get(d) || 0 }))
  }, [breaks])

  // Build 7-day series for meetings (count per day)
  const meetingSeries = useMemo(() => {
    const map = new Map<string, number>()
    meetings.forEach((m: any) => {
      const dateKey = new Date(m.start_time || m.created_at || Date.now()).toLocaleDateString('en-CA')
      map.set(dateKey, (map.get(dateKey) || 0) + 1)
    })
    const days: string[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days.push(d.toLocaleDateString('en-CA'))
    }
    return days.map((d) => ({ date: d, count: map.get(d) || 0 }))
  }, [meetings])

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
              <h1 className="text-3xl font-bold text-foreground">Overview</h1>
              <p className="text-muted-foreground">Your activity, meetings, and recent tickets at a glance</p>
            </div>
            <Link href="/forms/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </Link>
          </div>

          <ShiftResetTimer />

          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allTickets.length}</div>
                <p className="text-xs text-muted-foreground">All support requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('In Progress')}</div>
                <p className="text-xs text-muted-foreground">Being worked on</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Closed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('Closed')}</div>
                <p className="text-xs text-muted-foreground">Completed tickets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Meetings (7d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{meetings.length}</div>
                <p className="text-xs text-muted-foreground">Scheduled and completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Break Time (last 7 days)</CardTitle>
                <CardDescription>Total minutes per day</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={breakSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <defs>
                      <linearGradient id="breakGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <ReTooltip 
                      formatter={(v: any) => [`${Number(v).toLocaleString()} min`, 'Breaks']}
                      labelFormatter={(l) => l}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Area type="monotone" dataKey="minutes" stroke="hsl(var(--chart-2))" fill="url(#breakGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Meetings (last 7 days)</CardTitle>
                <CardDescription>Count per day</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={meetingSeries} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <ReTooltip 
                      formatter={(v: any) => [v, 'Meetings']} 
                      labelFormatter={(l) => l}
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                      }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Bar dataKey="count" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Tickets</CardTitle>
                  <CardDescription>Your latest 5 support requests</CardDescription>
                </div>
                <Link href="/forms/my-tickets">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentTickets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
                  <p className="text-muted-foreground mb-4">Create your first support ticket to get started</p>
                  <Link href="/forms/new">
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First Ticket
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentTickets.map((ticket) => (
                    <div key={ticket.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">{ticket.id}</h4>
                          {getStatusBadge(ticket.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(ticket.createdAt || ticket.date)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            <span>{ticket.category}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.concern}</p>
                      </div>
                      <Link href={`/forms/${ticket.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
