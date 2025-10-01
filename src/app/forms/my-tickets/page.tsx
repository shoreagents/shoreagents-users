"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Search, Filter, FileText, Calendar,  Eye, Clock, AlertTriangle, CheckCircle, X } from "lucide-react"
import Link from "next/link"
import { Ticket } from "@/lib/ticket-utils"
import { useTickets, type Ticket as ReactQueryTicket } from "@/hooks/use-tickets"
import { NewTicketDialog } from "@/components/new-ticket-dialog"

export default function MyTicketsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("newest")
  const [currentPage, setCurrentPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false)
  const ticketsPerPage = 12

  // Use React Query to fetch tickets
  const { data: ticketsData, isLoading: loading, error, refetch, triggerRealtimeUpdate } = useTickets()
  
  // Convert React Query tickets to the expected Ticket format with useMemo to prevent re-renders
  const tickets: Ticket[] = useMemo(() => {
    const reactQueryTickets = ticketsData?.tickets || []
    return reactQueryTickets.map((ticket: ReactQueryTicket) => ({
      id: ticket.id,
      name: ticket.name,
      concern: ticket.concern,
      details: ticket.details || '',
      category: ticket.category,
      status: ticket.status as any,
      date: ticket.date,
      createdAt: ticket.createdAt,
      position: ticket.position,
      categoryId: ticket.categoryId,
      fileCount: ticket.fileCount,
      files: ticket.files || [],
      email: ticket.email || '',
      userId: ticket.userId,
      userEmail: ticket.userEmail,
    }))
  }, [ticketsData?.tickets])

  // Extract unique categories from tickets for filter dropdown with useMemo
  const categories = useMemo(() => {
    return Array.from(
      new Set(tickets.map(ticket => ticket.category).filter(Boolean))
    ).map(category => ({ id: 0, name: category }))
  }, [tickets])

  // Setup SSE to receive realtime updates from Postgres NOTIFY/LISTEN
  useEffect(() => {
    const es = new EventSource('/api/tickets?stream=1')
    const debounceRef = { timer: null as any }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'connected') return
        // Debounce refetch to coalesce bursts of changes
        if (debounceRef.timer) clearTimeout(debounceRef.timer)
        debounceRef.timer = setTimeout(async () => {
          // Trigger real-time update with cache bypass
          setIsUpdating(true)
          await triggerRealtimeUpdate()
          setIsUpdating(false)
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
      es.close()
      if (debounceRef.timer) clearTimeout(debounceRef.timer)
    }
  }, [triggerRealtimeUpdate])

  // Optimize filtering and sorting with useMemo to prevent infinite loops
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets] // Create a copy to avoid mutating the original array

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

    return filtered
  }, [tickets, searchTerm, statusFilter, categoryFilter, sortBy])

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, statusFilter, categoryFilter, sortBy])

  // Calculate pagination
  const totalPages = Math.ceil(filteredTickets.length / ticketsPerPage)
  const startIndex = (currentPage - 1) * ticketsPerPage
  const endIndex = startIndex + ticketsPerPage
  const currentTickets = filteredTickets.slice(startIndex, endIndex)

  // Active filter count
  const activeFilterCount = [
    searchTerm,
    statusFilter !== "all" ? statusFilter : null,
    categoryFilter !== "all" ? categoryFilter : null,
    sortBy !== "newest" ? sortBy : null
  ].filter(Boolean).length

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setCategoryFilter("all")
    setSortBy("newest")
    setCurrentPage(1)
  }

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

  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Tickets</h3>
              <p className="text-muted-foreground mb-4">
                {error?.message || 'An unexpected error occurred while loading your tickets.'}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Try Again
              </Button>
            </div>
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
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-foreground">My Support Tickets</h1>
              </div>
              <p className="text-muted-foreground">View and manage your support requests</p>
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="pl-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-5 w-5 p-0"
                    onClick={() => {
                      setSearchTerm("")
                      setCurrentPage(1)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline"  className="h-9">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 min-w-5 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Filter Tickets</h4>
                      {activeFilterCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="h-8 text-xs"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Status</label>
                        <Select value={statusFilter} onValueChange={(value: string) => {
                          setStatusFilter(value)
                          setCurrentPage(1)
                        }}>
                          <SelectTrigger className="h-8">
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

                      <div>
                        <label className="text-sm font-medium mb-1 block">Category</label>
                        <Select value={categoryFilter} onValueChange={(value: string) => {
                          setCategoryFilter(value)
                          setCurrentPage(1)
                        }}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.name} value={category.name}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Sort By</label>
                        <Select value={sortBy} onValueChange={(value: string) => {
                          setSortBy(value)
                          setCurrentPage(1)
                        }} key={sortBy}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select sort order" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">Newest First</SelectItem>
                            <SelectItem value="oldest">Oldest First</SelectItem>
                            <SelectItem value="name">Name A-Z</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
              <h2 className="text-xl font-semibold">
                {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} found
              </h2>
                {filteredTickets.length >= ticketsPerPage && (
                  <p className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredTickets.length)} of {filteredTickets.length} tickets
                  </p>
                )}
              </div>
              <Button onClick={() => setIsNewTicketDialogOpen(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Create New Ticket
              </Button>
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
                  <Button onClick={() => setIsNewTicketDialogOpen(true)}>
                    Create Your First Ticket
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Ticket ID</TableHead>
                        <TableHead className="w-[150px] hidden lg:table-cell">Concern</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[140px] hidden md:table-cell">Category</TableHead>
                        <TableHead className="w-[150px] hidden lg:table-cell">Created</TableHead>
                        <TableHead className="w-[80px] hidden sm:table-cell">Files</TableHead>
                        <TableHead className="w-[60px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {currentTickets.map((ticket) => (
                      <TableRow key={ticket.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm font-medium text-primary">
                          {ticket.id}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[300px]">
                            <p className="font-medium text-foreground line-clamp-1 truncate">{ticket.concern}</p>
                            {ticket.details && (
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{ticket.details}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(ticket.status)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(ticket.category)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(ticket.createdAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {ticket.files && ticket.files.length > 0 ? (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>{ticket.files.length}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/forms/${ticket.id}`}>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
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
              </Card>

                {/* Pagination */}
                {filteredTickets.length >= ticketsPerPage && (
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
      
      {/* New Ticket Dialog */}
      <NewTicketDialog 
        open={isNewTicketDialogOpen} 
        onOpenChange={setIsNewTicketDialogOpen} 
      />
    </SidebarProvider>
  )
} 