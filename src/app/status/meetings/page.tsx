"use client"

import { useState, useEffect, useMemo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  MessageSquare, 
  Clock, 
  Users, 
  Plus,
  Square,
  AlertTriangle,
  Video,
  Phone,
  X,
  RefreshCw,
  LogOut,
  CalendarDays
} from "lucide-react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar24 } from "@/components/ui/date-picker"
import { canCreateMeeting, type Meeting } from "@/lib/meeting-utils"
import { useMeeting } from "@/contexts/meeting-context"
import { useEventsContext } from "@/contexts/events-context"
import { useBreak } from "@/contexts/break-context"
import { useSocket } from "@/contexts/socket-context"
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator"
import { toast } from "sonner"
import { 
  useMeetings, 
  useMeetingCounts,
  useCreateMeeting, 
  useStartMeeting, 
  useEndMeeting,  
  useCancelMeeting,
  useRefreshMeetings,
  type Meeting as MeetingType 
} from "@/hooks/use-meetings"

// MeetingCard Component
interface MeetingCardProps {
  meeting: Meeting
  onStart: (id: number) => void
  onEnd: (id: number) => void
  onCancel: (id: number) => void
  formatTime: (time: string) => string
  getStatusColor: (status: Meeting['status']) => string
  getTypeIcon: (type: Meeting['meeting_type']) => any
}

function MeetingCard({ 
  meeting, 
  onStart, 
  onEnd, 
  onCancel, 
  formatTime, 
  getStatusColor, 
  getTypeIcon,
  isInEvent,
  isBreakActive
}: MeetingCardProps & { isInEvent: boolean; isBreakActive: boolean }) {
  const TypeIcon = getTypeIcon(meeting.meeting_type)
  const isActive = meeting.status === 'in-progress'
  const now = new Date()
  const meetingStartTime = new Date(meeting.start_time)
  // Add 10-minute grace period to match the database function logic
  const gracePeriodMs = 10 * 60 * 1000 // 10 minutes in milliseconds
  // Add 2-second buffer to account for scheduler timing (0.5s interval + processing time)
  const schedulerBufferMs = 2 * 1000 // 2 seconds in milliseconds
  const canStart = meeting.status === 'scheduled' && 
    meetingStartTime <= new Date(now.getTime() - schedulerBufferMs) && 
    (now.getTime() - meetingStartTime.getTime()) <= gracePeriodMs &&
    !isInEvent && // Don't show starting automatically if user is in an event
    !isBreakActive // Don't show starting automatically if user is on break

  return (
    <Card className={`relative transition-all duration-200 ${isActive ? 'ring-2 ring-green-500 shadow-md' : 'hover:shadow-sm'}`}>
  <CardHeader className="pb-4">
    <div className="flex items-start justify-between">
      {/* Title & Icon */}
      <div className="flex items-center gap-2">
        <TypeIcon className="h-5 w-5 text-gray-500" />
        <CardTitle className="text-lg font-semibold leading-tight">
          {meeting.title}
        </CardTitle>
      </div>

      {/* Status Badge */}
      <Badge className={`${getStatusColor(meeting.status)} capitalize`}>
        {meeting.status.replace('-', ' ')}
      </Badge>
    </div>

    {/* Description */}
    {meeting.description && (
      <CardDescription className="mt-2 text-sm text-gray-600">
        {meeting.description}
      </CardDescription>
    )}
  </CardHeader>

  <CardContent className="space-y-5">
    {/* Time Info */}
    <div className="flex items-center justify-between text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400" />
        {meeting.status === 'in-progress' ? (
          <span className="font-medium text-green-600">
            {(() => {
              try {
                let startTime: Date

                if (meeting.start_time.includes('T')) {
                  startTime = new Date(meeting.start_time)
                } else if (meeting.start_time.includes(' ')) {
                  startTime = new Date(meeting.start_time.replace(' +0800', ''))
                } else {
                  startTime = new Date(meeting.start_time)
                }

                const now = new Date()
                const elapsedMs = now.getTime() - startTime.getTime()

                if (elapsedMs < 0) return 'Pending start...'

                const elapsedMinutes = Math.floor(elapsedMs / 60000)
                const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
                return `Running: ${elapsedMinutes}m ${elapsedSeconds}s`
              } catch {
                return 'Running: 0m 0s'
              }
            })()}
          </span>
        ) : (
          <span>
            {meeting.end_time
              ? `${formatTime(meeting.start_time)} - ${formatTime(meeting.end_time)}`
              : `Started: ${formatTime(meeting.start_time)}`}
          </span>
        )}
      </div>

      {/* Duration / Status Note */}
      <span className="text-xs text-gray-500">
        {meeting.status === 'completed' && meeting.duration_minutes > 0
          ? `${meeting.duration_minutes} min`
          : meeting.status === 'scheduled'
            ? 'Scheduled'
            : meeting.status === 'in-progress'
              ? ''
              : ''}
      </span>
    </div>

    {/* Action Buttons */}
    <div className="flex gap-3 pt-1">
      {meeting.status === 'scheduled' && (
        <div className="flex items-center justify-center flex-1 text-sm rounded-lg dark:bg-gray-50 bg-gray-200 text-black">
          {canStart ? (
            <span className="text-green-600 font-medium">Starting automatically...</span>
          ) : isInEvent ? (
            <span className="text-amber-600 font-medium">Waiting for event to end</span>
          ) : isBreakActive ? (
            <span className="text-orange-600 font-medium">Waiting for break to end</span>
          ) : (
            <span>Scheduled for {formatTime(meeting.start_time)}</span>
          )}
        </div>
      )}

      {meeting.status === 'in-progress' && (
        <>
          <div className="flex flex-1 items-center justify-center text-center text-sm rounded-lg bg-green-50 text-green-700 font-medium">
            Meeting Active
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onEnd(meeting.id)}
            className="flex-1 flex items-center justify-center gap-1"
          >
            <Square className="h-4 w-4" />
            End
          </Button>
        </>
      )}

      {meeting.status === 'scheduled' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onCancel(meeting.id)}
          className="flex-1 flex items-center justify-center gap-1"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      )}
    </div>
  </CardContent>
</Card>

  )
}

// Skeleton component for loading state
function MeetingCardSkeleton() {
  return (
    <Card className="relative">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="flex gap-3 pt-1">
          <Skeleton className="h-8 flex-1" />
        </div>
      </CardContent>
    </Card>
  )
}

// Helper function to generate pagination items with truncation
const generatePaginationItems = (currentPage: number, totalPages: number) => {
  const items = []
  const maxVisiblePages = 7 // Show up to 7 page numbers
  
  if (totalPages <= maxVisiblePages) {
    // Show all pages if total is small
    for (let i = 1; i <= totalPages; i++) {
      items.push(i)
    }
  } else {
    // Always show first page
    items.push(1)
    
    if (currentPage <= 4) {
      // Near the beginning: 1, 2, 3, 4, 5, ..., last
      for (let i = 2; i <= 5; i++) {
        items.push(i)
      }
      items.push('ellipsis')
      items.push(totalPages)
    } else if (currentPage >= totalPages - 3) {
      // Near the end: 1, ..., last-4, last-3, last-2, last-1, last
      items.push('ellipsis')
      for (let i = totalPages - 4; i <= totalPages; i++) {
        items.push(i)
      }
    } else {
      // In the middle: 1, ..., current-1, current, current+1, ..., last
      items.push('ellipsis')
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        items.push(i)
      }
      items.push('ellipsis')
      items.push(totalPages)
    }
  }
  
  return items
}

export default function MeetingsPage() {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [isPaginationLoading, setIsPaginationLoading] = useState(false)
  
  // Calculate offset for pagination
  const offset = (currentPage - 1) * itemsPerPage

  // Initial mount state to prevent empty display flash
  const [isInitialMount, setIsInitialMount] = useState(true)

  // Use meeting context as primary source to prevent duplicate API calls
  const { 
    meetings: contextMeetings, 
    isInMeeting: contextIsInMeeting,
    currentMeeting: contextCurrentMeeting,
    isLoading: contextLoading,
    refreshMeetings: contextRefreshMeetings
  } = useMeeting()

  // Clear loading state immediately if agent is already in a meeting when page loads
  useEffect(() => {
    if (contextIsInMeeting && contextCurrentMeeting) {
      setIsScheduledMeetingLoading(false)
    }
  }, [contextIsInMeeting, contextCurrentMeeting])
  
  // Use events context for leave event functionality
  const { currentEvent, leaveEvent, isInEvent } = useEventsContext()
  
  // Use break context to check if agent is on break
  const { isBreakActive } = useBreak()
  
  // Use socket context for real-time updates
  const { socket, isConnected } = useSocket()
  
  // Fetch ALL meetings for filtering (not paginated)
  const { 
    data: allMeetingsData, 
    isLoading: allMeetingsLoading, 
    error: allMeetingsError,
    refetch: refetchAllMeetings
  } = useMeetings(7, 1000, 0) // Fetch up to 1000 meetings for filtering
  
  // Only use direct hooks for pagination-specific data (for "All" tab)
  const { 
    data: meetingsData, 
    isLoading: meetingsLoading, 
    error: meetingsError,
    refetch: refetchMeetings
  } = useMeetings(7, itemsPerPage, offset)
  
  // Use context for status data to prevent duplicate calls
  const statusData = useMemo(() => ({
    isInMeeting: contextIsInMeeting,
    activeMeeting: contextCurrentMeeting
  }), [contextIsInMeeting, contextCurrentMeeting])
  const statusLoading = contextLoading
  const statusError = null

  // Get meeting counts for tabs
  const { 
    data: countsData, 
    isLoading: countsLoading, 
    error: countsError 
  } = useMeetingCounts(7)
  
  // Mutation hooks
  const createMeetingMutation = useCreateMeeting()
  const startMeetingMutation = useStartMeeting()
  const endMeetingMutation = useEndMeeting()
  const cancelMeetingMutation = useCancelMeeting()
  const refreshMeetings = useRefreshMeetings()
  
  // Removed legacy context usage to prevent duplicate requests
  // All data fetching is now handled by direct hooks above
  
  // Extract data from react-query and ensure compatibility
  // Use all meetings data for filtering, but paginated data for "All" tab
  const allMeetings = useMemo(() => {
    return (allMeetingsData?.meetings || []).map(meeting => ({
      ...meeting,
      is_in_meeting: meeting.status === 'in-progress'
    }))
  }, [allMeetingsData?.meetings])
  
  const meetings = useMemo(() => {
    return (meetingsData?.meetings || []).map(meeting => ({
      ...meeting,
      is_in_meeting: meeting.status === 'in-progress'
    }))
  }, [meetingsData?.meetings])

  // Immediate check for in-progress meetings when meetings data changes
  useEffect(() => {
    const hasInProgressMeetings = allMeetings.some(meeting => meeting.status === 'in-progress')
    const hasScheduledMeetings = allMeetings.some(meeting => meeting.status === 'scheduled')
    
    // Immediate check - meetings data changed
    
    if (hasInProgressMeetings) {
      // Meeting has started, clear loading state
      // Meeting started - clear loading state immediately
      setIsScheduledMeetingLoading(false)
    } else if (!hasScheduledMeetings) {
      // No scheduled meetings, clear loading state
      // No scheduled meetings - clear loading state
      setIsScheduledMeetingLoading(false)
    } else {
      // Check if any scheduled meetings are overdue and should start immediately
      const now = new Date()
      const overdueMeetings = allMeetings.filter(meeting => {
        if (meeting.status !== 'scheduled') return false
        const meetingStartTime = new Date(meeting.start_time)
        // Add 2-second grace period before considering overdue
        return meetingStartTime <= new Date(now.getTime() - 2 * 1000)
      })
      
      if (overdueMeetings.length > 0) {
        // Found overdue meetings - trigger immediate refresh
        refetchMeetings()
      }
    }
  }, [allMeetings, refetchMeetings])

  // Extract pagination info
  const pagination = meetingsData?.pagination || {
    total: 0,
    limit: itemsPerPage,
    offset: 0,
    hasMore: false,
    totalPages: 0,
    currentPage: 1
  }
  // Show loading if we're loading meetings, status, or counts, or if we don't have any data yet
  // This prevents the empty state from flashing before data loads
  const loading = isInitialMount || meetingsLoading || allMeetingsLoading || statusLoading || countsLoading
  
  // Debug logging removed - loading state is working correctly
  
  // Show loading state when pagination is changing (meetingsLoading is true but we have data)
  const paginationLoading = isPaginationLoading || (meetingsLoading && meetingsData)
  
  // Check if we're still in the initial loading phase (queries not yet enabled)
  const isInitializing = meetingsLoading === false && statusLoading === false && countsLoading === false && !meetingsData && !statusData
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  
  // Add meeting form state
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    type: 'video' as 'video' | 'audio' | 'in-person',
    scheduledTime: new Date().toISOString().slice(0, 16) // Default to current time
  })
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedTime, setSelectedTime] = useState<string>(new Date().toTimeString().slice(0, 5))
  const [customTitle, setCustomTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createMeetingReason, setCreateMeetingReason] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [showLeaveEventDialog, setShowLeaveEventDialog] = useState(false)
  const [currentEventToLeave, setCurrentEventToLeave] = useState<any>(null)
  const [isLeavingEvent, setIsLeavingEvent] = useState(false)
  const [isImmediateMeeting, setIsImmediateMeeting] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [filteredCurrentPage, setFilteredCurrentPage] = useState(1)
  const [isScheduledMeetingLoading, setIsScheduledMeetingLoading] = useState(false)

  // Filter meetings based on active tab
  const filteredMeetings = useMemo(() => {
    switch (activeTab) {
      case 'today':
        return allMeetings.filter(meeting => {
          const now = new Date()
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          
          const meetingStartTime = new Date(meeting.start_time)
          const meetingDate = new Date(meetingStartTime.getFullYear(), meetingStartTime.getMonth(), meetingStartTime.getDate())
          
          return meetingDate.getTime() === today.getTime()
        })
      case 'scheduled':
        return allMeetings.filter(meeting => meeting.status === 'scheduled')
      case 'in-progress':
        return allMeetings.filter(meeting => meeting.status === 'in-progress')
      case 'completed':
        return allMeetings.filter(meeting => meeting.status === 'completed')
      default:
        return meetings // Use paginated meetings for "All" tab
    }
  }, [allMeetings, meetings, activeTab])

  // Calculate pagination for filtered results
  const filteredPagination = useMemo(() => {
    const totalFiltered = filteredMeetings.length
    const itemsPerPage = 9 // Based on the grid layout (3x3)
    const totalPages = Math.ceil(totalFiltered / itemsPerPage)
    
    return {
      total: totalFiltered,
      totalPages: totalPages,
      currentPage: filteredCurrentPage,
      hasMore: totalPages > 1
    }
  }, [filteredMeetings, filteredCurrentPage])

  // Get paginated meetings for display
  const paginatedMeetings = useMemo(() => {
    const itemsPerPage = 9
    const startIndex = (filteredCurrentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredMeetings.slice(startIndex, endIndex)
  }, [filteredMeetings, filteredCurrentPage])

  // Dynamically check if user can create new meeting based on ALL existing meetings
  const canCreateNewMeeting = useMemo(() => {
    // Use contextMeetings which contains all meetings, not just the current page
    const allMeetings = contextMeetings || []
    
    // Check if there are any scheduled or in-progress meetings across ALL pages
    const hasScheduled = allMeetings.some(meeting => meeting.status === 'scheduled')
    const hasInProgress = allMeetings.some(meeting => meeting.status === 'in-progress')
    
    if (hasScheduled) {
      setCreateMeetingReason('You have a scheduled meeting that hasn\'t started yet. Please start or cancel it before creating a new one.')
      return false
    } else if (hasInProgress) {
      setCreateMeetingReason('You have an ongoing meeting. Please end it before creating a new one.')
      return false
    } else {
      setCreateMeetingReason(null)
      return true
    }
  }, [contextMeetings])

  // Handle initial mount state
  useEffect(() => {
    // Reset initial mount state when any data loads or after a timeout
    if (meetingsData || allMeetingsData || statusData) {
      setIsInitialMount(false)
    }
    
    // Fallback: reset initial mount after 5 seconds to prevent stuck loading
    const timeout = setTimeout(() => {
      setIsInitialMount(false)
    }, 5000)
    
    return () => clearTimeout(timeout)
  }, [meetingsData, allMeetingsData, statusData])

  // Update current time every second for elapsed time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync date and time with scheduledTime
  useEffect(() => {
    if (selectedDate && selectedTime) {
      // Use local date formatting to avoid timezone issues
      const year = selectedDate.getFullYear()
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDate.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      // Ensure time is in HH:MM format
      const timeStr = selectedTime.includes(':') ? selectedTime : `${selectedTime}:00`
      
      // Create a proper Date object in local timezone and convert to ISO string
      // This ensures the timezone is properly handled
      const localDateTime = new Date(`${dateStr}T${timeStr}`)
      setNewMeeting(prev => ({ ...prev, scheduledTime: localDateTime.toISOString() }))
    }
  }, [selectedDate, selectedTime])

  // Note: canCreateNewMeeting is now computed dynamically based on meetings data

  // Listen for automatic meeting start events
  useEffect(() => {
    const handleMeetingStarted = (event: CustomEvent) => {
      // Refresh meeting data to ensure consistency
      setIsScheduledMeetingLoading(false) // Clear loading state immediately
      // Only call one refresh method to prevent duplicate API calls
      refetchMeetings()
    }

    const handleEventLeft = (event: CustomEvent) => {
      // Single refresh is sufficient - the database function will handle the rest
      setIsScheduledMeetingLoading(false) // Clear loading state immediately
      // Only call one refresh method to prevent duplicate API calls
      refetchMeetings()
    }

    window.addEventListener('meeting_started', handleMeetingStarted as EventListener)
    window.addEventListener('event-left', handleEventLeft as EventListener)
    
    return () => {
      window.removeEventListener('meeting_started', handleMeetingStarted as EventListener)
      window.removeEventListener('event-left', handleEventLeft as EventListener)
    }
  }, [refetchMeetings])

  // Track if socket has cleared loading state to prevent polling from overriding
  const [socketClearedLoading, setSocketClearedLoading] = useState(false)

  // Listen for socket events for real-time meeting updates
  useEffect(() => {
    if (!socket || !isConnected) return

    let refreshTimeout: NodeJS.Timeout | null = null

    const debouncedRefresh = () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
      refreshTimeout = setTimeout(() => {
        // Only call one refresh method to prevent duplicate API calls
        refetchMeetings()
        // Remove contextRefreshMeetings() call to prevent duplicate requests
      }, 500) // Increased to 500ms to reduce API calls
    }

    const handleMeetingStarted = () => {
      // Immediate refresh when meeting starts via socket
      setIsScheduledMeetingLoading(false) // Clear loading state immediately
      setSocketClearedLoading(true) // Mark that socket cleared it
      // Only call one refresh method to prevent duplicate API calls
      refetchMeetings()
    }

    const handleMeetingEnded = () => {
      // Immediate refresh when meeting ends via socket
      setIsScheduledMeetingLoading(false) // Clear loading state immediately
      setSocketClearedLoading(true) // Mark that socket cleared it
      // Only call one refresh method to prevent duplicate API calls
      refetchMeetings()
    }

    const handleMeetingStatusUpdate = () => {
      // Debounced refresh for status updates
      // Only clear loading state if we're not waiting for scheduled meetings
      const now = new Date()
      const hasScheduledMeetingsWaiting = allMeetings.some(meeting => {
        if (meeting.status !== 'scheduled') return false
        const meetingStartTime = new Date(meeting.start_time)
        return meetingStartTime <= now
      })
      
      if (!hasScheduledMeetingsWaiting) {
        setIsScheduledMeetingLoading(false) // Clear loading state only if no scheduled meetings waiting
      }
      setSocketClearedLoading(true) // Mark that socket cleared it
      debouncedRefresh()
    }

    // Add socket event listeners
    socket.on('meeting_started', handleMeetingStarted)
    socket.on('meeting_ended', handleMeetingEnded)
    socket.on('meeting-status-update', handleMeetingStatusUpdate)
    socket.on('meeting-update', handleMeetingStatusUpdate)

    return () => {
      // Clean up socket event listeners and timeout
      if (refreshTimeout) {
        clearTimeout(refreshTimeout)
      }
      socket.off('meeting_started', handleMeetingStarted)
      socket.off('meeting_ended', handleMeetingEnded)
      socket.off('meeting-status-update', handleMeetingStatusUpdate)
      socket.off('meeting-update', handleMeetingStatusUpdate)
    }
  }, [socket, isConnected, refetchMeetings, contextRefreshMeetings, allMeetings])

  // Reset socket cleared flag only when we have no scheduled meetings waiting
  useEffect(() => {
    const now = new Date()
    const hasScheduledMeetingsWaiting = allMeetings.some(meeting => {
      if (meeting.status !== 'scheduled') return false
      const meetingStartTime = new Date(meeting.start_time)
      // Add 2-second grace period before considering waiting
      return meetingStartTime <= new Date(now.getTime() - 2 * 1000)
    })

    // Only reset socket cleared flag if there are no scheduled meetings waiting
    if (!hasScheduledMeetingsWaiting) {
      setSocketClearedLoading(false)
    }
  }, [allMeetings])

  // Periodic refresh for scheduled meetings to catch automatic starts
  // Only poll if user is NOT in an event to prevent unnecessary API calls
  useEffect(() => {
    // Use meeting context as primary source of truth for current meeting status
    if (contextIsInMeeting && contextCurrentMeeting) {
      // Agent is already in a meeting - clear loading state immediately
      setIsScheduledMeetingLoading(false)
      return
    }

    // Check if there are any scheduled meetings that should have started
    // Use allMeetings instead of meetings to check ALL meetings, not just current page
    const now = new Date()
    const hasScheduledMeetingsWaiting = allMeetings.some(meeting => {
      if (meeting.status !== 'scheduled') return false
      const meetingStartTime = new Date(meeting.start_time)
      // Add 2-second grace period before showing loading state
      return meetingStartTime <= new Date(now.getTime() - 2 * 1000)
    })

    // Check if any meetings have actually started (changed to in-progress)
    const hasInProgressMeetings = allMeetings.some(meeting => meeting.status === 'in-progress')

    // Debug logging removed for production

    if (!hasScheduledMeetingsWaiting || isInEvent || isBreakActive || hasInProgressMeetings) {
      // No scheduled meetings waiting, user is in event, user is on break, or meetings have started
      // Clear loading state - no meetings waiting or meeting started
      setIsScheduledMeetingLoading(false)
      return
    }

    // Don't manually start meetings - let the backend scheduler handle it
    // The backend scheduler runs every 500ms and will start meetings automatically

    // Set loading state when waiting for meetings to start
    setIsScheduledMeetingLoading(true)
    
    // Set a timeout to prevent stuck loading state (30 seconds max)
    const loadingTimeout = setTimeout(() => {
      // Meeting auto-start loading timeout - clearing loading state
      setIsScheduledMeetingLoading(false)
    }, 30 * 1000) // Reduced to 30 seconds

    const interval = setInterval(() => {
      // Don't override if socket has already cleared the loading state
      if (socketClearedLoading) {
        // Skip interval check - socket already cleared loading
        return
      }

      // Check if any scheduled meetings should have started
      // Use allMeetings instead of meetings to check ALL meetings, not just current page
      const now = new Date()
      const hasScheduledMeetingsWaiting = allMeetings.some(meeting => {
        if (meeting.status !== 'scheduled') return false
        const meetingStartTime = new Date(meeting.start_time)
        // Add 2-second grace period before showing loading state
        return meetingStartTime <= new Date(now.getTime() - 2 * 1000)
      })

      // Check if any meetings have actually started (changed to in-progress)
      const hasInProgressMeetings = allMeetings.some(meeting => meeting.status === 'in-progress')

      // Interval check for meeting status

      if (hasScheduledMeetingsWaiting && !hasInProgressMeetings) {
        // Check if meeting is significantly overdue (more than 5 seconds)
        const overdueMeetings = allMeetings.filter(meeting => {
          if (meeting.status !== 'scheduled') return false
          const meetingStartTime = new Date(meeting.start_time)
          const now = new Date()
          return meetingStartTime <= new Date(now.getTime() - 5 * 1000) // 5 seconds overdue
        })

        if (overdueMeetings.length > 0) {
          // Meeting is overdue - try to start it manually as fallback
          const overdueMeeting = overdueMeetings[0]
          startMeetingMutation.mutate(overdueMeeting.id)
        }

        // Still waiting for meetings to start - backend scheduler will handle it
        setIsScheduledMeetingLoading(true)
        // Only call one refresh method to prevent duplicate API calls
        refetchMeetings()
      } else {
        // No scheduled meetings waiting or meetings have started
        // Clear loading state - meeting started or no meetings waiting
        setIsScheduledMeetingLoading(false)
      }
    }, 500) // Reduced to 500ms to match backend scheduler frequency

    return () => {
      clearInterval(interval)
      clearTimeout(loadingTimeout)
      setIsScheduledMeetingLoading(false)
    }
  }, [allMeetings, refetchMeetings, isInEvent, isBreakActive, socketClearedLoading, startMeetingMutation, contextIsInMeeting, contextCurrentMeeting])

  // Periodic sync check to ensure UI consistency
  useEffect(() => {
    const hasActiveMeetings = meetings.some(meeting => meeting.status === 'in-progress')
    
    if (!hasActiveMeetings) return

    const interval = setInterval(() => {
      // Check if any in-progress meetings should be completed
      // This is a fallback to catch any missed status updates
      const now = new Date()
      const shouldSync = meetings.some(meeting => {
        if (meeting.status !== 'in-progress') return false
        const meetingStartTime = new Date(meeting.start_time)
        const elapsedHours = (now.getTime() - meetingStartTime.getTime()) / (1000 * 60 * 60)
        // If meeting has been running for more than 8 hours, it's likely stale
        return elapsedHours > 8
      })

      if (shouldSync) {
        // Only call one refresh method to prevent duplicate API calls
        refetchMeetings()
      }
    }, 120000) // OPTIMIZED: Increased from 30 seconds to 2 minutes to reduce API calls

    return () => clearInterval(interval)
  }, [meetings, refetchMeetings])

  const getStatusColor = (status: Meeting['status']) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500'
      case 'in-progress': return 'bg-green-500'
      case 'completed': return 'bg-gray-500'
      case 'cancelled': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getTypeIcon = (type: Meeting['meeting_type']) => {
    switch (type) {
      case 'video': return Video
      case 'audio': return Phone
      case 'in-person': return Users
      default: return MessageSquare
    }
  }

  const formatTime = (timeStr: string) => {
    // Convert the database time to Philippine timezone for display
    let date: Date
    
    if (timeStr.includes('T')) {
      // ISO datetime format: "2025-08-06T06:27:01.264Z"
      date = new Date(timeStr)
    } else if (timeStr.includes(' ')) {
      // Database format: "2025-08-06 06:27:01.264 +0800"
      // Parse as Philippine timezone
      const philippineTime = new Date(timeStr.replace(' +0800', ''))
      date = philippineTime
    } else {
      // Simple time format
      const [hours, minutes] = timeStr.split(':')
      date = new Date()
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0)
    }
    
    // Format in 12-hour format
    const hour = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    
    return `${displayHour}:${minutes} ${ampm}`
  }


  const handleStartMeeting = async (meetingId: number) => {
    try {
      await startMeetingMutation.mutateAsync(meetingId)
      
      // Update can-create status with a small delay to ensure database is updated
      // Note: canCreateNewMeeting is now computed dynamically

    } catch (error) {
      console.error('Error starting meeting:', error)
      setError('Failed to start meeting')
    }
  }

    const handleEndMeeting = async (meetingId: number) => {
    try {
      await endMeetingMutation.mutateAsync(meetingId)
      
      // Update can-create status with a small delay to ensure database is updated
      // Note: canCreateNewMeeting is now computed dynamically

    } catch (error) {
      console.error('Error ending meeting:', error)
      setError('Failed to end meeting')
    }
  }

  const handleCancelMeeting = async (meetingId: number) => {
    try {
      await cancelMeetingMutation.mutateAsync(meetingId)

      // Update can-create status with a small delay to ensure database is updated
      // Note: canCreateNewMeeting is now computed dynamically

    } catch (error) {
      console.error('Error cancelling meeting:', error)
      setError('Failed to cancel meeting')
    }
  }

  const handleAddMeeting = async () => {
    try {
      setSubmitting(true)
      setDialogError(null)

      // Validate form fields first
      if (!newMeeting.title) {
        setDialogError('Please fill in the meeting title')
        return
      }

      // Only require date/time for scheduled meetings
      if (!isImmediateMeeting) {
        if (!selectedDate || !selectedTime) {
          setDialogError('Please select a meeting date and time')
          return
        }

        // Validate that the scheduled time is not in the past
        const timeStr = selectedTime.includes(':') ? selectedTime : `${selectedTime}:00`
        // Create date in local timezone to avoid UTC conversion issues
        const scheduledDateTime = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), 
          parseInt(timeStr.split(':')[0]), parseInt(timeStr.split(':')[1]), parseInt(timeStr.split(':')[2] || '0'))
        const now = new Date()
        
        // Add a 5-minute buffer to allow scheduling meetings that are just slightly in the past
        const bufferTime = new Date(now.getTime() - 5 * 60 * 1000) // 5 minutes in the past
        
        if (scheduledDateTime < bufferTime) {
          setDialogError('Meeting time cannot be more than 5 minutes in the past')
          return
        }
      }

      // Validate custom title if selected
      if (newMeeting.title === 'custom' && !customTitle.trim()) {
        setDialogError('Please enter a custom meeting title')
        return
      }

      // Only check meeting validation if form is properly filled
      const canCreate = await canCreateMeeting()
      if (!canCreate.canCreate) {
        // Check if the reason is about being in an event
        if (canCreate.reason?.includes('Cannot create meeting while in event')) {
          setCurrentEventToLeave(currentEvent)
          setShowLeaveEventDialog(true)
          return
        } else {
          setDialogError(canCreate.reason || 'Cannot create meeting at this time')
          return
        }
      }

      // Determine the actual title to use
      const actualTitle = newMeeting.title === 'custom' ? customTitle : newMeeting.title

      // For immediate meetings, don't pass scheduledTime (let API use current time)
      // For scheduled meetings, use the selected date/time
      const scheduledTime = isImmediateMeeting ? undefined : newMeeting.scheduledTime

      // Create new meeting via react-query mutation
      await createMeetingMutation.mutateAsync({
        title: actualTitle,
        description: newMeeting.description,
        type: newMeeting.type,
        scheduledTime: scheduledTime
      })

      // Note: canCreateNewMeeting is now computed dynamically

      // Reset form
      setNewMeeting({
        title: '',
        description: '',
        type: 'video' as 'video' | 'audio' | 'in-person',
        scheduledTime: new Date().toISOString().slice(0, 16)
      })
      setSelectedDate(new Date())
      setSelectedTime(new Date().toTimeString().slice(0, 5))
      setCustomTitle('')
      setIsImmediateMeeting(false)

      // Close dialog
      setShowAddForm(false)

    } catch (error) {
      console.error('Error adding meeting:', error)
      setError('Failed to add meeting')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setNewMeeting({
      title: '',
      description: '',
      type: 'video' as 'video' | 'audio' | 'in-person',
      scheduledTime: new Date().toISOString().slice(0, 16)
    })
    setSelectedDate(new Date())
    setSelectedTime(new Date().toTimeString().slice(0, 5))
    setCustomTitle('')
    setDialogError(null)
    setIsImmediateMeeting(false)
  }

  const handleLeaveEvent = async () => {
    try {
      setIsLeavingEvent(true)
      if (currentEventToLeave) {
        await leaveEvent(currentEventToLeave.event_id)
        toast.success(`Left event: ${currentEventToLeave.title}`)
        setShowLeaveEventDialog(false)
        setCurrentEventToLeave(null)
        // After leaving event, try to create the meeting again
        handleAddMeeting()
      }
    } catch (error) {
      console.error('Error leaving event:', error)
      toast.error('Failed to leave event. Please try again.')
      setDialogError('Failed to leave event. Please try again.')
    } finally {
      setIsLeavingEvent(false)
    }
  }

  // Helper functions to organize meetings with pagination
  const getMeetingsByStatus = (status: Meeting['status']) => {
    return meetings.filter(meeting => meeting.status === status)
  }

  // Get counts from the API
  const counts = countsData || {
    total: 0,
    today: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0
  }

  // Server-side pagination - no need for client-side pagination helpers

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Handle pagination loading state
  useEffect(() => {
    if (meetingsLoading && meetingsData) {
      setIsPaginationLoading(true)
    } else {
      setIsPaginationLoading(false)
    }
  }, [meetingsLoading, meetingsData])

  // Handle page change with immediate loading state
  const handlePageChange = (newPage: number) => {
    setIsPaginationLoading(true)
    setCurrentPage(newPage)
  }

  // Handle filtered page changes
  const handleFilteredPageChange = (page: number) => {
    setFilteredCurrentPage(page)
  }

  // Reset filtered page when tab changes
  useEffect(() => {
    setFilteredCurrentPage(1)
  }, [activeTab])

  if (loading || isInitializing) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="p-6 space-y-6">
            {/* Header Skeleton */}
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-8 w-64 mb-2" />
                <Skeleton className="h-4 w-80" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>

            {/* Tabs Skeleton */}
            <div className="grid w-full grid-cols-5 gap-1 p-1 bg-muted rounded-lg">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>

            {/* Meeting Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <MeetingCardSkeleton key={i} />
              ))}
            </div>
          </div>
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
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-600">{error}</p>
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
        <div className="p-6 space-y-6">
          {/* Pagination Loading Overlay */}
          {paginationLoading && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }, (_, i) => (
                    <MeetingCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Meeting Management</h1>
              <p className="text-muted-foreground">Manage your meetings and schedules</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={refreshMeetings} 
                variant="outline" 
                size="sm"
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button 
                        onClick={() => setShowAddForm(true)} 
                        size="sm"
                        disabled={!canCreateNewMeeting}
                        className="flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Meeting
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {!canCreateNewMeeting && createMeetingReason && (
                    <TooltipContent >
                      <p>{createMeetingReason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Meetings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All ({counts.total})</TabsTrigger>
              <TabsTrigger value="today">Today ({counts.today})</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled ({counts.scheduled})</TabsTrigger>
              <TabsTrigger value="in-progress">Active ({counts.inProgress})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {meetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isInEvent={isInEvent}
                    isBreakActive={isBreakActive}
                  />
                ))}
              </div>
              {pagination.totalPages > 1 && meetings.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {generatePaginationItems(currentPage, pagination.totalPages).map((item, index) => (
                      <PaginationItem key={index}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handlePageChange(item as number)}
                            isActive={currentPage === item}
                            className="cursor-pointer"
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handlePageChange(Math.min(pagination.totalPages, currentPage + 1))}
                        className={currentPage === pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>

            <TabsContent value="today" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedMeetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isInEvent={isInEvent}
                    isBreakActive={isBreakActive}
                  />
                ))}
              </div>
              {filteredPagination.totalPages > 1 && paginatedMeetings.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handleFilteredPageChange(Math.max(1, filteredPagination.currentPage - 1))}
                        className={filteredPagination.currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {generatePaginationItems(filteredPagination.currentPage, filteredPagination.totalPages).map((item, index) => (
                      <PaginationItem key={index}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handleFilteredPageChange(item as number)}
                            isActive={filteredPagination.currentPage === item}
                            className="cursor-pointer"
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handleFilteredPageChange(Math.min(filteredPagination.totalPages, filteredPagination.currentPage + 1))}
                        className={filteredPagination.currentPage === filteredPagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedMeetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isInEvent={isInEvent}
                    isBreakActive={isBreakActive}
                  />
                ))}
              </div>
              {filteredPagination.totalPages > 1 && paginatedMeetings.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handleFilteredPageChange(Math.max(1, filteredPagination.currentPage - 1))}
                        className={filteredPagination.currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {generatePaginationItems(filteredPagination.currentPage, filteredPagination.totalPages).map((item, index) => (
                      <PaginationItem key={index}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handleFilteredPageChange(item as number)}
                            isActive={filteredPagination.currentPage === item}
                            className="cursor-pointer"
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handleFilteredPageChange(Math.min(filteredPagination.totalPages, filteredPagination.currentPage + 1))}
                        className={filteredPagination.currentPage === filteredPagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>

            <TabsContent value="in-progress" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedMeetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isInEvent={isInEvent}
                    isBreakActive={isBreakActive}
                  />
                ))}
              </div>
              {filteredPagination.totalPages > 1 && paginatedMeetings.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handleFilteredPageChange(Math.max(1, filteredPagination.currentPage - 1))}
                        className={filteredPagination.currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {generatePaginationItems(filteredPagination.currentPage, filteredPagination.totalPages).map((item, index) => (
                      <PaginationItem key={index}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handleFilteredPageChange(item as number)}
                            isActive={filteredPagination.currentPage === item}
                            className="cursor-pointer"
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handleFilteredPageChange(Math.min(filteredPagination.totalPages, filteredPagination.currentPage + 1))}
                        className={filteredPagination.currentPage === filteredPagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedMeetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isInEvent={isInEvent}
                    isBreakActive={isBreakActive}
                  />
                ))}
              </div>
              {filteredPagination.totalPages > 1 && paginatedMeetings.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => handleFilteredPageChange(Math.max(1, filteredPagination.currentPage - 1))}
                        className={filteredPagination.currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {generatePaginationItems(filteredPagination.currentPage, filteredPagination.totalPages).map((item, index) => (
                      <PaginationItem key={index}>
                        {item === 'ellipsis' ? (
                          <PaginationEllipsis />
                        ) : (
                          <PaginationLink
                            onClick={() => handleFilteredPageChange(item as number)}
                            isActive={filteredPagination.currentPage === item}
                            className="cursor-pointer"
                          >
                            {item}
                          </PaginationLink>
                        )}
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => handleFilteredPageChange(Math.min(filteredPagination.totalPages, filteredPagination.currentPage + 1))}
                        className={filteredPagination.currentPage === filteredPagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>
          </Tabs>

          {/* Empty State - Only show when we have confirmed there are no meetings */}
          {filteredMeetings.length === 0 && !loading && !isInitializing && !paginationLoading && (meetingsData || allMeetingsData) && !meetingsLoading && !allMeetingsLoading && 
           (currentPage === 1 || pagination.total === 0) && (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {activeTab === 'all' ? 'No meetings scheduled' : 
                   activeTab === 'today' ? 'No meetings today' :
                   activeTab === 'scheduled' ? 'No scheduled meetings' :
                   activeTab === 'in-progress' ? 'No active meetings' :
                   activeTab === 'completed' ? 'No completed meetings' :
                   'No meetings found'}
                </h3>
                <p className="text-gray-600 mb-4">
                  {activeTab === 'all' ? 'Get started by creating your first meeting' :
                   activeTab === 'today' ? 'No meetings scheduled for today' :
                   activeTab === 'scheduled' ? 'No meetings are currently scheduled' :
                   activeTab === 'in-progress' ? 'No meetings are currently in progress' :
                   activeTab === 'completed' ? 'No meetings have been completed yet' :
                   'Try switching to a different tab or create a new meeting'}
                </p>
                {activeTab === 'all' && (
                  <Button onClick={() => setShowAddForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Meeting
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Meeting Dialog */}
        <Dialog open={showAddForm} onOpenChange={(open) => {
          setShowAddForm(open)
          if (!open) resetForm()
        }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Meeting</DialogTitle>
              <DialogDescription>
                Create a new meeting with details and participants.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
                             {/* Title */}
               <div className="space-y-2">
                 <Label htmlFor="title">Meeting Title *</Label>
                 <div className="space-y-2">
                   <Select
                     value={newMeeting.title}
                     onValueChange={(value) => setNewMeeting(prev => ({ ...prev, title: value }))}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select meeting title or type custom" />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="In a Meeting">In a Meeting</SelectItem>
                       <SelectItem value="Team Standup">Team Standup</SelectItem>
                       <SelectItem value="Project Review">Project Review</SelectItem>
                       <SelectItem value="Client Call">Client Call</SelectItem>
                       <SelectItem value="Training Session">Training Session</SelectItem>
                       <SelectItem value="Planning Meeting">Planning Meeting</SelectItem>
                       <SelectItem value="Status Update">Status Update</SelectItem>
                       <SelectItem value="Brainstorming">Brainstorming</SelectItem>
                       <SelectItem value="One-on-One">One-on-One</SelectItem>
                       <SelectItem value="Interview">Interview</SelectItem>
                       <SelectItem value="custom">Custom Title...</SelectItem>
                     </SelectContent>
                   </Select>
                                       {newMeeting.title === 'custom' && (
                      <Input
                        placeholder="Enter custom meeting title"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        className="mt-2"
                      />
                    )}
                 </div>
               </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter meeting description"
                  value={newMeeting.description}
                  onChange={(e) => setNewMeeting(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Meeting Timing */}
              <div className="space-y-2">
                <Label>Meeting Timing</Label>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="immediate"
                    name="timing"
                    checked={isImmediateMeeting}
                    onChange={() => setIsImmediateMeeting(true)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="immediate" className="text-sm font-normal">
                    Start immediately
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="scheduled"
                    name="timing"
                    checked={!isImmediateMeeting}
                    onChange={() => setIsImmediateMeeting(false)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="scheduled" className="text-sm font-normal">
                    Schedule for later
                  </Label>
                </div>
              </div>

              {/* Scheduled Time - Only show when not immediate */}
              {!isImmediateMeeting && (
                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">Meeting Time *</Label>
                  <Calendar24
                    date={selectedDate}
                    onDateChange={setSelectedDate}
                    time={selectedTime}
                    onTimeChange={setSelectedTime}
                    minDate={new Date()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Select when you want to schedule this meeting
                  </p>
                </div>
              )}

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Meeting Type</Label>
                <Select
                                     value={newMeeting.type}
                   onValueChange={(value) => setNewMeeting(prev => ({ ...prev, type: value as Meeting['meeting_type'] }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video Call</SelectItem>
                    <SelectItem value="audio">Audio Call</SelectItem>
                    <SelectItem value="in-person">In-Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              

              {/* Error Display */}
              {dialogError && (
                <div className="flex items-center gap-2 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{dialogError}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMeeting}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Add Meeting
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Leave Event Dialog */}
        <Dialog open={showLeaveEventDialog} onOpenChange={setShowLeaveEventDialog}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-amber-500" />
                Leave Event to Create Meeting
              </DialogTitle>
              <DialogDescription>
                You're currently in an event and cannot create a meeting. Would you like to leave the event to proceed with creating your meeting?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {currentEventToLeave && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-sm text-amber-900 dark:text-amber-100">
                        Current Event:
                      </h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        {currentEventToLeave.title}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                disabled={isLeavingEvent}
                onClick={() => {
                  setShowLeaveEventDialog(false)
                  setCurrentEventToLeave(null)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLeaveEvent}
                disabled={isLeavingEvent}
                className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
              >
                {isLeavingEvent ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Leaving Event...
                  </>
                ) : (
                  <>
                    <LogOut className="h-4 w-4" />
                    Leave Event & Create Meeting
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <GlobalLoadingIndicator 
          customLoading={isScheduledMeetingLoading}
          customLoadingText="Starting scheduled meeting..."
        />
      </SidebarInset>
    </SidebarProvider>
  )
}

