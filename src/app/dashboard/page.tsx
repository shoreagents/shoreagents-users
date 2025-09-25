"use client"

import { useMemo, useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardSkeleton } from "@/components/skeleton-loaders"
import { useActivityTracker } from "@/hooks/use-activity-tracker"
import { useDashboardData } from "@/hooks/use-dashboard"
import { useEventsContext } from "@/contexts/events-context"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Plus,
  Calendar,
  Tag,
  Eye,
  Target,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  ExternalLink
} from "lucide-react"
import Link from "next/link"
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
  PieChart,
  Pie,
  Cell,
} from "recharts"

export default function DashboardPage() {
  // Track user activity to prevent away status
  useActivityTracker()

  // State for time period selection
  const [selectedPeriod, setSelectedPeriod] = useState<'7D' | '30D'>('7D')
  const days = selectedPeriod === '7D' ? 7 : 30
  
  // Test sound function
  const testSound = async (type: string = 'inactivity') => {
    try {
      if (window.electronAPI?.testSoundPlayback) {
        const result = await window.electronAPI.testSoundPlayback(type)
        console.log('Sound test result:', result)
      } else {
        console.log('Electron API not available')
      }
    } catch (error) {
      console.error('Sound test error:', error)
    }
  }
  

  // Use React Query hooks for all dashboard data
  const {
    allTickets,
    recentTickets,
    breaks,
    meetings,
    taskStats,
    isLoading,
    hasError
  } = useDashboardData(days)
  
  const { events } = useEventsContext()

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'For Approval':
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50">
            <Clock className="w-3 h-3 mr-1" />
            For Approval
          </Badge>
        )
      case 'On Hold':
        return (
          <Badge variant="destructive" className="text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            On Hold
          </Badge>
        )
      case 'In Progress':
        return (
          <Badge variant="default" className="bg-blue-500 text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            In Progress
          </Badge>
        )
      case 'Approved':
        return (
          <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        )
      case 'Stuck':
        return (
          <Badge variant="destructive" className="text-white">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Stuck
          </Badge>
        )
      case 'Actioned':
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700 bg-blue-50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Actioned
          </Badge>
        )
      case 'Closed':
        return (
          <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
            <CheckCircle className="w-3 h-3 mr-1" />
            Closed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-500 text-gray-700 bg-gray-50">
            <Clock className="w-3 h-3 mr-1" />
            {status}
          </Badge>
        )
    }
  }

  // Build series for breaks using only break_date and duration_minutes
  const breakSeries = useMemo(() => {
    const map = new Map<string, number>()
    breaks.forEach((s) => {
      const dateKey = s.break_date ? new Date(s.break_date as any).toLocaleDateString('en-CA') : new Date(s.start_time).toLocaleDateString('en-CA')
      const raw = s.duration_minutes as any
      const minutes = typeof raw === 'string' ? parseFloat(raw) : raw
      if (!Number.isFinite(minutes) || minutes <= 0) return
      map.set(dateKey, (map.get(dateKey) || 0) + minutes)
    })
    const dayKeys: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dayKeys.push(d.toLocaleDateString('en-CA'))
    }
    return dayKeys.map((d) => ({ 
      date: selectedPeriod === '30D' ? d.slice(5) : d, // Remove year for 30D (YYYY-MM-DD -> MM-DD)
      minutes: map.get(d) || 0 
    }))
  }, [breaks, days, selectedPeriod])

  // Build series for meetings (count per day)
  const meetingSeries = useMemo(() => {
    const map = new Map<string, number>()
    meetings.forEach((m: any) => {
      const dateKey = new Date(m.start_time || m.created_at || Date.now()).toLocaleDateString('en-CA')
      map.set(dateKey, (map.get(dateKey) || 0) + 1)
    })
    const dayKeys: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dayKeys.push(d.toLocaleDateString('en-CA'))
    }
    return dayKeys.map((d) => ({ 
      date: selectedPeriod === '30D' ? d.slice(5) : d, // Remove year for 30D (YYYY-MM-DD -> MM-DD)
      count: map.get(d) || 0 
    }))
  }, [meetings, days, selectedPeriod])

  // Prepare task data for charts
  const taskGroupData = useMemo(() => {
    if (!taskStats?.groups) return []
    return taskStats.groups.map(group => ({
      name: group.group_title,
      count: parseInt(group.task_count) || 0,
      color: group.group_color.includes('blue') ? '#3b82f6' : 
             group.group_color.includes('green') ? '#10b981' :
             group.group_color.includes('yellow') ? '#f59e0b' :
             group.group_color.includes('red') ? '#ef4444' :
             group.group_color.includes('purple') ? '#8b5cf6' : '#6b7280'
    }))
  }, [taskStats])

  const priorityData = useMemo(() => {
    if (!taskStats?.priorities) return []
    return taskStats.priorities.map(priority => ({
      name: priority.priority.charAt(0).toUpperCase() + priority.priority.slice(1),
      value: parseInt(priority.count) || 0,
      color: priority.priority === 'urgent' ? '#ef4444' :
             priority.priority === 'high' ? '#f59e0b' :
             priority.priority === 'normal' ? '#3b82f6' : '#6b7280'
    }))
  }, [taskStats])

  if (isLoading) {
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
              <p className="text-muted-foreground">Your activity, tasks, meetings, and recent tickets at a glance</p>
            </div>
            {/* Sound Test Buttons - Remove in production */}
            {typeof window !== 'undefined' && window.electronAPI && (
              <div className="flex gap-2">
                <button
                  onClick={() => testSound('inactivity')}
                  className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Test Inactivity Sound
                </button>
                <button
                  onClick={() => testSound('main')}
                  className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Test Main Sound
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex items-center gap-2">
                <div className="flex bg-muted rounded-lg p-1">
                  <button
                    onClick={() => setSelectedPeriod('7D')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      selectedPeriod === '7D'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setSelectedPeriod('30D')}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${
                      selectedPeriod === '30D'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    30D
                  </button>
                </div>
              </div>
              <Link href="/productivity/task-activity">
                <Button variant="outline">
                  <Target className="mr-2 h-4 w-4" />
                  Task Board
                </Button>
              </Link>
              <Link href="/forms/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Ticket
                </Button>
              </Link>
            </div>
          </div>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 group">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                  <Link href="/productivity/task-activity">
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                  </Link>
                </div>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{taskStats?.totalTasks || 0}</div>
                <p className="text-xs text-muted-foreground">Active tasks</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 group">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Events & Activities</CardTitle>
                  <Link href="/status/events">
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                  </Link>
                </div>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{events.length}</div>
                <p className="text-xs text-muted-foreground">Total events</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 group">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                  <Link href="/forms/my-tickets">
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                  </Link>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{allTickets.length}</div>
                <p className="text-xs text-muted-foreground">All support requests</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 group">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium">Meetings</CardTitle>
                  <Link href="/status/meetings">
                    <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                  </Link>
                </div>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{meetings.length}</div>
                <p className="text-xs text-muted-foreground">Scheduled and completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Charts Row */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Break Time</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{selectedPeriod}</span>
                  </div>
                </div>
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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Meetings</CardTitle>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{selectedPeriod}</span>
                  </div>
                </div>
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



          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Task Summary by Status Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Task Summary by Status</CardTitle>
                <CardDescription>Task counts across all groups</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {taskStats?.groups && taskStats.groups.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taskStats.groups} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="group_title" 
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <ReTooltip 
                        formatter={(v: any) => [v, 'Tasks']}
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
                      <Bar 
                        dataKey="task_count" 
                        fill="hsl(var(--chart-1))" 
                        radius={[4, 4, 0, 0]}
                        name="Task Count"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No task data available</p>
                      <p className="text-sm text-muted-foreground">Create your first task to see the summary</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Task Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Task Priority Distribution</CardTitle>
                <CardDescription>Tasks by priority level</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {priorityData && priorityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {priorityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ReTooltip 
                        formatter={(v: any) => [v, 'Tasks']}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          color: 'hsl(var(--foreground))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                        }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                        labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No priority data</p>
                      <p className="text-sm text-muted-foreground">Create tasks with priorities to see distribution</p>
                    </div>
                  </div>
                )}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead className="hidden sm:table-cell">Status</TableHead>
                        <TableHead className="hidden md:table-cell">Category</TableHead>
                        <TableHead className="hidden lg:table-cell">Date</TableHead>
                        <TableHead className="w-[50px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTickets.map((ticket) => (
                        <TableRow key={ticket.id} className="group">
                          <TableCell className="font-mono text-sm font-medium text-primary">
                            {ticket.id}
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground truncate" title={ticket.concern}>
                                {ticket.concern}
                              </p>
                              {/* Show status and category on mobile */}
                              <div className="flex items-center gap-2 sm:hidden">
                                {getStatusBadge(ticket.status)}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Tag className="h-3 w-3" />
                                  <span>{ticket.category}</span>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {getStatusBadge(ticket.status)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Tag className="h-3 w-3" />
                              <span>{ticket.category}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(ticket.createdAt || ticket.date)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link href={`/forms/${ticket.id}`}>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
