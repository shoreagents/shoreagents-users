"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { TicketDetailsSkeleton } from "@/components/skeleton-loaders"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  User, 
  Mail, 
  Tag, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Download,
  Eye
} from "lucide-react"
import Link from "next/link"
import { getCurrentUserTickets, Ticket } from "@/lib/ticket-utils"

export default function TicketDetailsPage() {
  const params = useParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const loadTicket = async () => {
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const ticketId = params.id as string
      const userTickets = getCurrentUserTickets()
      const foundTicket = userTickets.find((t: Ticket) => t.id === ticketId)
      
      if (foundTicket) {
        setTicket(foundTicket)
      } else {
        setNotFound(true)
      }
      setLoading(false)
    }

    loadTicket()
  }, [params.id])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      case 'in-progress':
        return <Badge variant="default" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          In Progress
        </Badge>
      case 'resolved':
        return <Badge variant="outline" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Resolved
        </Badge>
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
        return 'Check-in (chat with account manager)'
      default:
        return category
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <TicketDetailsSkeleton />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (notFound || !ticket) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <div className="flex items-center gap-4">
              <Link href="/forms/my-tickets">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to My Tickets
                </Button>
              </Link>
            </div>
            <Card className="max-w-2xl mx-auto">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                                 <h3 className="text-lg font-semibold mb-2">Ticket Not Found</h3>
                 <p className="text-muted-foreground text-center mb-4">
                   The ticket you&apos;re looking for doesn&apos;t exist or has been removed.
                 </p>
                <Link href="/forms/my-tickets">
                  <Button>
                    View My Tickets
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
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
          <div className="flex items-center gap-4">
            <Link href="/forms/my-tickets">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to My Tickets
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Ticket Details</h1>
              <p className="text-muted-foreground">View support ticket information</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ticket Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold">{ticket.name}</h2>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Created: {formatDate(ticket.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Date: {ticket.date}</span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {ticket.id}
                    </Badge>
                  </div>
                </CardHeader>
              </Card>

              {/* Employee Information */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Employee Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Employee Name</label>
                      <p className="text-sm mt-1">{ticket.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Employee Nickname</label>
                      <p className="text-sm mt-1">{ticket.nickname}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                      <p className="text-sm mt-1">{ticket.email}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Ticket Date</label>
                      <p className="text-sm mt-1">{ticket.date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ticket Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <CardTitle>Ticket Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <div className="mt-1">
                      <Badge variant="outline">{getCategoryLabel(ticket.category)}</Badge>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Concern</label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ticket.concern}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Comments</label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{ticket.comments}</p>
                  </div>

                  {ticket.details && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Additional Details</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{ticket.details}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments */}
              {ticket.files && ticket.files.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-muted-foreground" />
                      <CardTitle>Attachments</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {ticket.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{file}</span>
                          </div>
                          <Button variant="outline" size="sm">
                            <Eye className="mr-2 h-3 w-3" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Status Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Status Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Status</label>
                    <div className="mt-2">
                      {getStatusBadge(ticket.status)}
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created</label>
                    <p className="text-sm mt-1">{formatDate(ticket.createdAt)}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Ticket ID</label>
                    <p className="text-sm mt-1 font-mono">{ticket.id}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col gap-1">
                  <Link href="/forms/new">
                    <Button className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Create New Ticket
                    </Button>
                  </Link>
                  <Link href="/forms/my-tickets">
                    <Button variant="outline" className="w-full justify-start">
                      <Eye className="mr-2 h-4 w-4" />
                      View All Tickets
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Support Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    If you need to update this ticket or have questions, please contact support.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>support@shoreagents.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>Response within 24-48 hours</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 