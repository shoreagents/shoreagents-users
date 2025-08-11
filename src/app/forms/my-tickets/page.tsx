"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MyTicketsSkeleton } from "@/components/skeleton-loaders"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { ArrowLeft, Search, Filter, FileText, Calendar, User, Mail, Tag, Eye, Clock, AlertTriangle, CheckCircle } from "lucide-react"
import Link from "next/link"
import { Ticket, getCurrentUser } from "@/lib/ticket-utils"

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [categories, setCategories] = useState<Array<{id: number, name: string}>>([])
  const ticketsPerPage = 5

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser?.email) {
      console.error('❌ No user email found')
      setTickets([])
      setFilteredTickets([])
      setLoading(false)
      return
    }

    const refreshTickets = async () => {
      try {
        const response = await fetch(`/api/tickets?email=${encodeURIComponent(currentUser.email)}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        })
        if (response.ok) {
          const result = await response.json()
          if (result.success) {
            setTickets(result.tickets)
            setFilteredTickets(result.tickets)
          } else {
            console.error('❌ Failed to load tickets:', result.error)
            setTickets([])
            setFilteredTickets([])
          }
        } else {
          console.error('❌ API request failed:', response.status)
          setTickets([])
          setFilteredTickets([])
        }
      } catch (err) {
        console.error('❌ Error refreshing tickets:', err)
      }
    }

    const loadInitial = async () => {
      try {
        await refreshTickets()
        const categoriesResponse = await fetch('/api/ticket-categories', { credentials: 'include' })
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json()
          if (categoriesData.success) setCategories(categoriesData.categories)
        }
      } finally {
        setLoading(false)
      }
    }

    loadInitial()

    // Setup SSE to receive realtime updates from Postgres NOTIFY/LISTEN
    const es = new EventSource('/api/tickets?stream=1')
    const debounceRef = { timer: null as any }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'connected') return
        // Debounce refetch to coalesce bursts of changes
        if (debounceRef.timer) clearTimeout(debounceRef.timer)
        debounceRef.timer = setTimeout(() => {
          refreshTickets()
        }, 400)
      } catch {}
    }

    es.onerror = () => {
      // Attempt a simple reconnect by closing and reopening after delay
      es.close()
      setTimeout(() => {
        // Trigger a rerun by updating state slightly if needed; simplest is to open a new ES
        const retry = new EventSource('/api/tickets?stream=1')
        retry.onmessage = es.onmessage
      }, 1500)
    }

    return () => {
      try { es.close() } catch {}
    }
  }, [])

  useEffect(() => {
    let filtered = tickets

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        (ticket.id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (ticket.concern?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (ticket.details?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (ticket.id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.status === statusFilter)
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.category === categoryFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "newest") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime()
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime()
        return dateB - dateA // Newest first (larger timestamp first)
      } else if (sortBy === "oldest") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime()
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime()
        return dateA - dateB // Oldest first (smaller timestamp first)
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name)
      }
      return 0
    })

    setFilteredTickets(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [tickets, searchTerm, statusFilter, categoryFilter, sortBy])

  // Calculate pagination
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage)
  const startIndex = (currentPage - 1) * ticketsPerPage
  const endIndex = startIndex + ticketsPerPage
  const currentTickets = filteredTickets.slice(startIndex, endIndex)

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
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

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <MyTicketsSkeleton />
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
            <div>
              <h1 className="text-3xl font-bold text-foreground">My Support Tickets</h1>
              <p className="text-muted-foreground">View and manage your support requests</p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Filters & Search</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search tickets..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="For Approval">For Approval</SelectItem>
                      <SelectItem value="On Hold">On Hold</SelectItem>
                      <SelectItem value="In Progress">In Progress</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Stuck">Stuck</SelectItem>
                      <SelectItem value="Actioned">Actioned</SelectItem>
                      <SelectItem value="Closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="name">Name A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
              <h2 className="text-xl font-semibold">
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} found
              </h2>
                {filteredTickets.length >= 5 && (
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredTickets.length)} of {filteredTickets.length} tickets
                  </p>
                )}
              </div>
              <Link href="/forms/new">
                <Button>
                  <FileText className="mr-2 h-4 w-4" />
                  Create New Ticket
                </Button>
              </Link>
            </div>

            {filteredTickets.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    {tickets.length === 0 
                      ? "You haven't created any support tickets yet."
                      : "No tickets match your current filters."
                    }
                  </p>
                  <Link href="/forms/new">
                    <Button>
                      Create Your First Ticket
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <>
              <div className="grid gap-3">
                  {currentTickets.map((ticket) => (
                  <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold truncate">{ticket.id}</h3>
                            {getStatusBadge(ticket.status)}
                            <Badge variant="outline" className="text-xs">
                              {getCategoryLabel(ticket.category)}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              #{ticket.position}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(ticket.createdAt)}</span>
                            </div>
                            {ticket.files && ticket.files.length > 0 && (
                              <div className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                <span>{ticket.files.length} file{ticket.files.length !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {ticket.concern}
                          </p>
                        </div>
                        
                        <Link href={`/forms/${ticket.id}`}>
                          <Button variant="outline" size="sm" className="ml-4 flex-shrink-0">
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

                {/* Pagination */}
                {filteredTickets.length >= 5 && (
                  <div className="flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious 
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        
                        {getPageNumbers().map((page, index) => (
                          <PaginationItem key={index}>
                            {page === 'ellipsis' ? (
                              <PaginationEllipsis />
                            ) : (
                              <PaginationLink
                                onClick={() => setCurrentPage(page as number)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            )}
                          </PaginationItem>
                        ))}
                        
                        <PaginationItem>
                          <PaginationNext 
                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 