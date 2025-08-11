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
  Eye,
  Image
} from "lucide-react"
import Link from "next/link"
import { Ticket } from "@/lib/ticket-utils"
import { ImageViewerDialog } from "@/components/image-viewer-dialog"

// Add interface for current user
interface CurrentUser {
  id: number
  email: string
  name: string
  role?: string
  user_type?: string
}

export default function TicketDetailsPage() {
  const params = useParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [imageViewerOpen, setImageViewerOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null)

  useEffect(() => {
    const loadTicket = async () => {
      try {
        const ticketId = params.id as string
        
        // Fetch ticket details from API
        const response = await fetch(`/api/tickets/${ticketId}`, {
          method: 'GET',
          credentials: 'include' // Include authentication cookies
        })
        
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            console.log('✅ Ticket loaded successfully:', result.ticket)
            console.log('Supporting files:', result.ticket.supportingFiles)
            console.log('Files (old format):', result.ticket.files)
            setTicket(result.ticket)
          } else {
            console.error('❌ Failed to load ticket:', result.error)
            setNotFound(true)
          }
        } else if (response.status === 404) {
          setNotFound(true)
        } else {
          console.error('❌ Error response:', response.status)
          setNotFound(true)
        }
      } catch (error) {
        console.error('❌ Error loading ticket:', error)
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }

    loadTicket()

    // Subscribe to SSE for this specific ticket
    const ticketId = params.id as string
    const es = new EventSource(`/api/tickets/${ticketId}?stream=1`)
    const debounce = { timer: null as any }
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'connected') return
        // Refresh details after a short debounce
        if (debounce.timer) clearTimeout(debounce.timer)
        debounce.timer = setTimeout(() => {
          loadTicket()
        }, 300)
      } catch {}
    }
    es.onerror = () => {
      try { es.close() } catch {}
    }
    return () => {
      try { es.close() } catch {}
    }
  }, [params.id])

  // Get current user information
  useEffect(() => {
    const getCurrentUserInfo = () => {
      if (typeof window === 'undefined') return null
      
      const authData = localStorage.getItem("shoreagents-auth")
      if (!authData) return null
      
      try {
        const parsed = JSON.parse(authData)
        if (parsed.isAuthenticated && parsed.user) {
          return parsed.user
        }
        return null
      } catch {
        return null
      }
    }

    const user = getCurrentUserInfo()
    setCurrentUser(user)
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'For Approval':
        return <Badge variant="outline" className="flex items-center gap-1 border-orange-500 text-orange-700 bg-orange-50">
          <Clock className="h-3 w-3" />
          For Approval
        </Badge>
      case 'On Hold':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          On Hold
        </Badge>
      case 'In Progress':
        return <Badge variant="default" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          In Progress
        </Badge>
      case 'Approved':
        return <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200">
          <CheckCircle className="h-3 w-3" />
          Approved
        </Badge>
      case 'Stuck':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Stuck
        </Badge>
      case 'Actioned':
        return <Badge variant="outline" className="flex items-center gap-1 text-blue-600 border-blue-200">
          <CheckCircle className="h-3 w-3" />
          Actioned
        </Badge>
      case 'Closed':
        return <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200">
          <CheckCircle className="h-3 w-3" />
          Closed
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

  const isImageFile = (fileName: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg']
    const lowerFileName = fileName.toLowerCase()
    const isImage = imageExtensions.some(ext => lowerFileName.endsWith(ext))
    console.log(`Checking if ${fileName} is image: ${isImage}`)
    return isImage
  }

  const openImageViewer = (url: string, fileName: string) => {
    console.log('Opening image viewer for:', { url, fileName })
    setSelectedImage({ url, name: fileName })
    setImageViewerOpen(true)
    console.log('State updated:', { selectedImage: { url, name: fileName }, imageViewerOpen: true })
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
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl font-bold">{ticket.id}</h2>
                          {getStatusBadge(ticket.status)}
                          <Badge variant="secondary" className="text-sm">
                            #{ticket.position}
                          </Badge>
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
                      <p className="text-sm mt-1">{currentUser?.name || ticket.userEmail || 'Unknown User'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                      <p className="text-sm mt-1">{currentUser?.email || ticket.email}</p>
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

                  {ticket.details && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Additional Details</label>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{ticket.details}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments */}
              {(() => {
                const hasFiles = (ticket.files && ticket.files.length > 0) || (ticket.supportingFiles && ticket.supportingFiles.length > 0)
                console.log('Rendering attachments section:', { 
                  hasFiles, 
                  filesLength: ticket.files?.length, 
                  supportingFilesLength: ticket.supportingFiles?.length 
                })
                return hasFiles
              })() && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle>Attachments ({ticket.fileCount || ticket.files?.length || 0})</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {/* Display files from Supabase storage (new format) */}
                      {ticket.supportingFiles && ticket.supportingFiles.length > 0 && (
                        ticket.supportingFiles.map((fileUrl, index) => {
                          // Extract filename from URL
                          const fileName = fileUrl.split('/').pop() || `File ${index + 1}`
                          const isImage = isImageFile(fileName)
                          console.log(`Processing file: ${fileName}, isImage: ${isImage}, URL: ${fileUrl}`)
                          
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                {isImage ? (
                                  <Image className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm">{fileName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isImage ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => openImageViewer(fileUrl, fileName)}
                                  >
                                    <Eye className="mr-2 h-3 w-3" />
                                    View Image
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => window.open(fileUrl, '_blank')}
                                  >
                                    <Eye className="mr-2 h-3 w-3" />
                                    View
                                  </Button>
                                )}

                              </div>
                            </div>
                          )
                        })
                      )}
                      
                      {/* Display files from old format (fallback) */}
                      {(!ticket.supportingFiles || ticket.supportingFiles.length === 0) && ticket.files && ticket.files.length > 0 && (
                        ticket.files.map((file, index) => {
                          const isImage = isImageFile(file)
                          return (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                {isImage ? (
                                  <Image className="h-4 w-4 text-blue-500" />
                                ) : (
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm">{file}</span>
                              </div>
                              <Button variant="outline" size="sm">
                                <Eye className="mr-2 h-3 w-3" />
                                View
                              </Button>
                            </div>
                          )
                        })
                      )}
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

                  {ticket.status === 'Closed' && (
                    <>
                      {ticket.resolvedByEmail && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Resolved By</label>
                          <p className="text-sm mt-1">{ticket.resolvedByEmail}</p>
                        </div>
                      )}
                      
                      {ticket.resolvedAt && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Resolved At</label>
                          <p className="text-sm mt-1">{formatDate(ticket.resolvedAt)}</p>
                        </div>
                      )}

                      {/* Show placeholder if no resolved info available */}
                      {!ticket.resolvedByEmail && !ticket.resolvedAt && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Resolved Information</label>
                          <p className="text-sm mt-1 text-muted-foreground">No resolution details available</p>
                        </div>
                      )}
                    </>
                  )}
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

        {/* Image Viewer Dialog */}
        {imageViewerOpen && selectedImage && (
          <ImageViewerDialog
            isOpen={imageViewerOpen}
            onClose={() => {
              setImageViewerOpen(false)
              setSelectedImage(null)
            }}
            imageUrl={selectedImage.url}
            fileName={selectedImage.name}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  )
} 