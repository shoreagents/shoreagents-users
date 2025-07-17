"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardSkeleton } from "@/components/skeleton-loaders"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  Calendar,
  FileText,
  PieChart,
  Activity,
  Target,
  Award
} from "lucide-react"
import { getCurrentUserTickets, Ticket } from "@/lib/ticket-utils"

interface AnalyticsData {
  totalTickets: number
  resolvedTickets: number
  pendingTickets: number
  inProgressTickets: number
  averageResolutionTime: number
  categoryBreakdown: Record<string, number>
  monthlyTrend: Record<string, number>
  topCategories: Array<{ category: string; count: number }>
  recentActivity: Array<{ action: string; timestamp: string; details: string }>
}

export default function AnalyticsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month')

  useEffect(() => {
    const loadAnalytics = async () => {
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userTickets = getCurrentUserTickets()
      setTickets(userTickets)
      
      // Calculate analytics
      const analyticsData = calculateAnalytics(userTickets, timeRange)
      setAnalytics(analyticsData)
      setLoading(false)
    }

    loadAnalytics()
  }, [timeRange])

  const calculateAnalytics = (tickets: Ticket[], range: string): AnalyticsData => {
    const now = new Date()
    const filteredTickets = tickets.filter(ticket => {
      const ticketDate = new Date(ticket.createdAt)
      const diffTime = Math.abs(now.getTime() - ticketDate.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      switch (range) {
        case 'week': return diffDays <= 7
        case 'month': return diffDays <= 30
        case 'quarter': return diffDays <= 90
        default: return true
      }
    })

    const categoryBreakdown: Record<string, number> = {}
    const monthlyTrend: Record<string, number> = {}
    
    filteredTickets.forEach(ticket => {
      // Category breakdown
      categoryBreakdown[ticket.category] = (categoryBreakdown[ticket.category] || 0) + 1
      
      // Monthly trend
      const month = new Date(ticket.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      monthlyTrend[month] = (monthlyTrend[month] || 0) + 1
    })

    const topCategories = Object.entries(categoryBreakdown)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const resolvedTickets = filteredTickets.filter(t => t.status === 'resolved')
    const averageResolutionTime = resolvedTickets.length > 0 
      ? resolvedTickets.reduce((acc, ticket) => {
          const created = new Date(ticket.createdAt)
          const resolved = new Date(ticket.date)
          return acc + Math.abs(resolved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        }, 0) / resolvedTickets.length
      : 0

    return {
      totalTickets: filteredTickets.length,
      resolvedTickets: filteredTickets.filter(t => t.status === 'resolved').length,
      pendingTickets: filteredTickets.filter(t => t.status === 'pending').length,
      inProgressTickets: filteredTickets.filter(t => t.status === 'in-progress').length,
      averageResolutionTime: Math.round(averageResolutionTime * 10) / 10,
      categoryBreakdown,
      monthlyTrend,
      topCategories,
      recentActivity: [
        { action: 'Ticket Resolved', timestamp: '2 hours ago', details: 'Computer/Equipment issue resolved' },
        { action: 'New Ticket Created', timestamp: '4 hours ago', details: 'Schedule request submitted' },
        { action: 'Ticket Updated', timestamp: '6 hours ago', details: 'Compensation inquiry in progress' },
        { action: 'Ticket Resolved', timestamp: '1 day ago', details: 'Transportation issue resolved' },
        { action: 'New Ticket Created', timestamp: '1 day ago', details: 'Suggestion submitted' }
      ]
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'computer': return 'Computer/Equipment'
      case 'station': return 'Station'
      case 'surroundings': return 'Surroundings'
      case 'schedule': return 'Schedule'
      case 'compensation': return 'Compensation'
      case 'transport': return 'Transport'
      case 'suggestion': return 'Suggestion'
      case 'checkin': return 'Check-in'
      default: return category
    }
  }

  const getResolutionRate = () => {
    if (!analytics) return 0
    return analytics.totalTickets > 0 
      ? Math.round((analytics.resolvedTickets / analytics.totalTickets) * 100)
      : 0
  }

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
              <h1 className="text-3xl font-bold text-foreground">Analytics Dashboard</h1>
              <p className="text-muted-foreground">Comprehensive insights into support ticket performance</p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={timeRange === 'week' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('week')}
              >
                Week
              </Button>
              <Button 
                variant={timeRange === 'month' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('month')}
              >
                Month
              </Button>
              <Button 
                variant={timeRange === 'quarter' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('quarter')}
              >
                Quarter
              </Button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalTickets || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {timeRange} period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getResolutionRate()}%</div>
                <p className="text-xs text-muted-foreground">
                  Successfully resolved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Resolution Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.averageResolutionTime || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Days to resolve
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Tickets</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(analytics?.pendingTickets || 0) + (analytics?.inProgressTickets || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Pending + In Progress
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Breakdowns */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Categories</CardTitle>
                <CardDescription>
                  Most common support request types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.topCategories.map((item, index) => (
                    <div key={item.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        <span className="text-sm">{getCategoryLabel(item.category)}</span>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status Distribution</CardTitle>
                <CardDescription>
                  Current ticket status breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Resolved</span>
                    </div>
                    <Badge variant="outline">{analytics?.resolvedTickets || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">In Progress</span>
                    </div>
                    <Badge variant="default">{analytics?.inProgressTickets || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <Badge variant="secondary">{analytics?.pendingTickets || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.details}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Performance Insights */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Resolution Rate:</span> {getResolutionRate()}% 
                    {getResolutionRate() >= 80 ? ' ✅' : ' ⚠️'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Avg Response Time:</span> {analytics?.averageResolutionTime || 0} days
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Customer Satisfaction:</span> High 📈
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Fast Resolution</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">High Engagement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Quality Support</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">• Monitor high-volume categories</p>
                  <p className="text-sm">• Optimize response times</p>
                  <p className="text-sm">• Focus on unresolved tickets</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 