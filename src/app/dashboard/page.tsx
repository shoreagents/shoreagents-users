"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { DashboardSkeleton } from "@/components/skeleton-loaders"
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
  User,
  Tag,
  Eye
} from "lucide-react"
import Link from "next/link"
import { getCurrentUserTickets, Ticket } from "@/lib/ticket-utils"

export default function DashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTickets = async () => {
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userTickets = getCurrentUserTickets()
      setTickets(userTickets)
      
      // Sort tickets by creation date (oldest first) and take the last 5
      const sortedTickets = userTickets.sort((a: Ticket, b: Ticket) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime()
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime()
        return dateB - dateA // Oldest first (smaller timestamp first)
      })
      setRecentTickets(sortedTickets.slice(-5))
      
      setLoading(false)
    }

    loadTickets()
  }, [])

  const getStatusCount = (status: string) => {
    return tickets.filter(ticket => ticket.status === status).length
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'in-progress':
        return <Badge variant="default">In Progress</Badge>
      case 'resolved':
        return <Badge variant="outline">Resolved</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'computer':
        return 'Computer/Equipment'
      case 'station':
        return 'Station'
      case 'surroundings':
        return 'Surroundings'
      case 'schedule':
        return 'Schedule'
      case 'compensation':
        return 'Compensation'
      case 'transport':
        return 'Transport'
      case 'suggestion':
        return 'Suggestion'
      case 'checkin':
        return 'Check-in'
      default:
        return category
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Calculate top 4 categories based on ticket counts
  const getTopCategories = () => {
    const categoryCounts: Record<string, number> = {}
    
    tickets.forEach(ticket => {
      categoryCounts[ticket.category] = (categoryCounts[ticket.category] || 0) + 1
    })
    
    // Convert to array and sort by count (descending)
    const sortedCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4) // Take top 4
    
    return sortedCategories
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
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Welcome to your ShoreAgents support dashboard</p>
            </div>
            <Link href="/forms/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tickets.length}</div>
                <p className="text-xs text-muted-foreground">
                  All support requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('pending')}</div>
                <p className="text-xs text-muted-foreground">
                  Awaiting response
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('in-progress')}</div>
                <p className="text-xs text-muted-foreground">
                  Being worked on
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resolved</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('resolved')}</div>
                <p className="text-xs text-muted-foreground">
                  Completed tickets
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Tickets</CardTitle>
                  <CardDescription>
                    Your latest support requests
                  </CardDescription>
                </div>
                <Link href="/forms/my-tickets">
                  <Button variant="outline" size="sm">
                    View All
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentTickets.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tickets yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first support ticket to get started
                  </p>
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
                          <h4 className="font-semibold">{ticket.name}</h4>
                          {getStatusBadge(ticket.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(ticket.createdAt)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            <span>{getCategoryLabel(ticket.category)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {ticket.concern}
                        </p>
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

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 flex flex-col gap-1">
                <Link href="/forms/new">
                  <Button className="w-full justify-start">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Support Ticket
                  </Button>
                </Link>
                <Link href="/forms/my-tickets">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-2 h-4 w-4" />
                    View All My Tickets
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Support Categories</CardTitle>
                <CardDescription>
                  Common support request types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {getTopCategories().map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                      <span className="text-sm">{getCategoryLabel(item.category)}</span>
                      <Badge variant="secondary">{item.count}</Badge>
                  </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
