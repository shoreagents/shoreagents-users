"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
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
  Calendar,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Square,
  CheckCircle,
  AlertTriangle,
  Video,
  Phone,
  X,
  RefreshCw
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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Calendar24 } from "@/components/ui/date-picker"
import { canCreateMeeting, type Meeting } from "@/lib/meeting-utils"
import { useMeeting } from "@/contexts/meeting-context"
import { 
  useMeetings, 
  useMeetingStatus, 
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
  getTypeIcon
}: MeetingCardProps) {
  const TypeIcon = getTypeIcon(meeting.meeting_type)
  const isActive = meeting.status === 'in-progress'
  const now = new Date()
  const meetingStartTime = new Date(meeting.start_time)
  const canStart = meeting.status === 'scheduled' && meetingStartTime <= now

  return (
    <Card className={`relative ${isActive ? 'ring-2 ring-green-500' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-5 w-5 text-gray-600" />
            <CardTitle className="text-lg">{meeting.title}</CardTitle>
          </div>
          <Badge className={getStatusColor(meeting.status)}>
            {meeting.status.replace('-', ' ')}
          </Badge>
        </div>
        <CardDescription className="text-sm">
          {meeting.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Time Info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-gray-500" />
            {meeting.status === 'in-progress' ? (
              <span className="font-medium text-green-600">
                {(() => {
                  // Calculate elapsed time for active meetings
                  const startTime = new Date(meeting.actual_start_time || meeting.start_time)
                  const now = new Date()
                  const elapsedMs = now.getTime() - startTime.getTime()
                  const elapsedMinutes = Math.floor(elapsedMs / 60000)
                  const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000)
                  return `Running: ${elapsedMinutes}m ${elapsedSeconds}s`
                })()}
              </span>
            ) : (
              <span>
                {meeting.end_time 
                  ? `${formatTime(meeting.start_time)} - ${formatTime(meeting.end_time)}`
                  : `Started: ${formatTime(meeting.start_time)}`
                }
              </span>
            )}
          </div>
          <span className="text-gray-500">
            {meeting.status === 'completed' && meeting.duration_minutes > 0
              ? `${meeting.duration_minutes} min`
              : meeting.status === 'scheduled' 
                ? 'Open-ended'
                : meeting.status === 'in-progress'
                  ? 'Active'
                  : ''
            }
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {meeting.status === 'scheduled' && (
            <div className="flex-1 text-center text-sm text-gray-500 py-2">
              {canStart ? (
                <span className="text-green-600 font-medium">Starting automatically...</span>
              ) : (
                <span>Scheduled for {formatTime(meeting.start_time)}</span>
              )}
            </div>
          )}
          
          {meeting.status === 'in-progress' && (
            <Button 
              size="sm" 
              variant="destructive"
              onClick={() => onEnd(meeting.id)}
              className="flex-1"
            >
              <Square className="h-4 w-4 mr-1" />
              End
            </Button>
          )}
          
          {meeting.status === 'scheduled' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onCancel(meeting.id)}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function MeetingsPage() {
  // Use react-query hooks for optimized data fetching
  const { 
    data: meetingsData, 
    isLoading: meetingsLoading, 
    error: meetingsError,
    refetch: refetchMeetings
  } = useMeetings(7)
  
  const { 
    data: statusData, 
    isLoading: statusLoading,
    error: statusError 
  } = useMeetingStatus(7)
  
  // Mutation hooks
  const createMeetingMutation = useCreateMeeting()
  const startMeetingMutation = useStartMeeting()
  const endMeetingMutation = useEndMeeting()
  const cancelMeetingMutation = useCancelMeeting()
  const refreshMeetings = useRefreshMeetings()
  
  // Legacy context for compatibility (can be removed later)
  const { 
    startNewMeeting, 
  } = useMeeting()
  
  // Extract data from react-query and ensure compatibility
  const meetings = useMemo(() => {
    return (meetingsData?.meetings || []).map(meeting => ({
      ...meeting,
      is_in_meeting: meeting.status === 'in-progress'
    }))
  }, [meetingsData?.meetings])
  const loading = meetingsLoading || statusLoading
  const queryError = meetingsError || statusError
  
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
  const [canCreateNewMeeting, setCanCreateNewMeeting] = useState(true)
  const [createMeetingReason, setCreateMeetingReason] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [totalMeetings, setTotalMeetings] = useState(0)

  // Update current time every second for elapsed time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])




  // Update total meetings count when meetings data changes
  useEffect(() => {
    setTotalMeetings(meetings.length)
  }, [meetings])

  // Sync date and time with scheduledTime
  useEffect(() => {
    if (selectedDate && selectedTime) {
      const dateStr = selectedDate.toISOString().split('T')[0]
      // Ensure time is in HH:MM format
      const timeStr = selectedTime.includes(':') ? selectedTime : `${selectedTime}:00`
      setNewMeeting(prev => ({ ...prev, scheduledTime: `${dateStr}T${timeStr}` }))
    }
  }, [selectedDate, selectedTime])

  // Initialize can-create status
  useEffect(() => {
    const initializeCanCreate = async () => {
      try {
        const canCreate = await canCreateMeeting()
        setCanCreateNewMeeting(canCreate.canCreate)
        setCreateMeetingReason(canCreate.reason || null)
      } catch (error) {
        console.error('Error checking can create meeting:', error)
      }
    }
    
    initializeCanCreate()
  }, [])

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
      
      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

    } catch (error) {
      console.error('Error starting meeting:', error)
      setError('Failed to start meeting')
    }
  }

    const handleEndMeeting = async (meetingId: number) => {
    try {
      await endMeetingMutation.mutateAsync(meetingId)
      


      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

    } catch (error) {
      console.error('Error ending meeting:', error)
      setError('Failed to end meeting')
    }
  }

  const handleCancelMeeting = async (meetingId: number) => {
    try {
      await cancelMeetingMutation.mutateAsync(meetingId)

      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

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

      if (!selectedDate || !selectedTime) {
        setDialogError('Please select a meeting date and time')
        return
      }

      // Validate that the scheduled time is not in the past
      const timeStr = selectedTime.includes(':') ? selectedTime : `${selectedTime}:00`
      const scheduledDateTime = new Date(`${selectedDate.toISOString().split('T')[0]}T${timeStr}`)
      const now = new Date()
      if (scheduledDateTime < now) {
        setDialogError('Meeting time cannot be in the past')
        return
      }

      // Validate custom title if selected
      if (newMeeting.title === 'custom' && !customTitle.trim()) {
        setDialogError('Please enter a custom meeting title')
        return
      }

      // Only check meeting validation if form is properly filled
      const canCreate = await canCreateMeeting()
      if (!canCreate.canCreate) {
        setDialogError(canCreate.reason || 'Cannot create meeting at this time')
        return
      }

      // Determine the actual title to use
      const actualTitle = newMeeting.title === 'custom' ? customTitle : newMeeting.title

      // Create new meeting via react-query mutation
      await createMeetingMutation.mutateAsync({
        title: actualTitle,
        description: newMeeting.description,
        type: newMeeting.type,
        scheduledTime: newMeeting.scheduledTime
      })

      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

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
  }

  // Helper functions to organize meetings with pagination
  const getMeetingsByStatus = (status: Meeting['status']) => {
    return meetings.filter(meeting => meeting.status === status)
  }

  const getRecentMeetings = (limit: number = 10) => {
    return meetings
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
  }

  const getTodayMeetings = () => {
    const today = new Date().toDateString()
    return meetings.filter(meeting => {
      const meetingDate = new Date(meeting.created_at).toDateString()
      return meetingDate === today
    })
  }

  // Pagination helper
  const getPaginatedMeetings = (meetingsList: Meeting[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return meetingsList.slice(startIndex, endIndex)
  }

  const getTotalPages = (meetingsList: Meeting[]) => {
    return Math.ceil(meetingsList.length / itemsPerPage)
  }

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex items-center justify-center h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading meetings...</p>
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
                    <TooltipContent className="bg-white border border-gray-200 text-gray-700">
                      <p>{createMeetingReason}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Current Time Display */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="text-lg font-medium">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
                <span className="text-gray-500">
                  {currentTime.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Meetings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All ({meetings.length})</TabsTrigger>
              <TabsTrigger value="today">Today ({getTodayMeetings().length})</TabsTrigger>
              <TabsTrigger value="scheduled">Scheduled ({getMeetingsByStatus('scheduled').length})</TabsTrigger>
              <TabsTrigger value="in-progress">Active ({getMeetingsByStatus('in-progress').length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({getMeetingsByStatus('completed').length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getPaginatedMeetings(getRecentMeetings(50)).map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </div>
              {getTotalPages(getRecentMeetings(50)) > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: getTotalPages(getRecentMeetings(50)) }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(getTotalPages(getRecentMeetings(50)), prev + 1))}
                        className={currentPage === getTotalPages(getRecentMeetings(50)) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>

            <TabsContent value="today" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getPaginatedMeetings(getTodayMeetings()).map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </div>
              {getTotalPages(getTodayMeetings()) > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: getTotalPages(getTodayMeetings()) }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          onClick={() => setCurrentPage(page)}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(getTotalPages(getTodayMeetings()), prev + 1))}
                        className={currentPage === getTotalPages(getTodayMeetings()) ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getMeetingsByStatus('scheduled').map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="in-progress" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getMeetingsByStatus('in-progress').map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getMeetingsByStatus('completed').map((meeting) => (
                  <MeetingCard 
                    key={meeting.id} 
                    meeting={meeting} 
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Empty State */}
          {meetings.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings scheduled</h3>
                <p className="text-gray-600 mb-4">Get started by creating your first meeting</p>
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Meeting
                </Button>
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

              {/* Scheduled Time */}
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
      </SidebarInset>
    </SidebarProvider>
  )
}
