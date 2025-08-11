"use client"

import { useState, useEffect, useRef } from "react"
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
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { getCurrentUserInfo } from "@/lib/user-profiles"
import { createMeeting, canCreateMeeting, type Meeting } from "@/lib/meeting-utils"
import { useMeeting } from "@/contexts/meeting-context"



const mockMeetings: Meeting[] = []

// MeetingCard Component
interface MeetingCardProps {
  meeting: Meeting
  meetingTimers: Record<number, { remaining: number; endTime: Date }>
  onStart: (id: number) => void
  onEnd: (id: number) => void
  onCancel: (id: number) => void
  formatTime: (time: string) => string
  formatRemainingTime: (ms: number) => string
  getStatusColor: (status: Meeting['status']) => string
  getTypeIcon: (type: Meeting['meeting_type']) => any
  isMeetingTimeValid: (meeting: Meeting) => boolean
}

function MeetingCard({ 
  meeting, 
  meetingTimers, 
  onStart, 
  onEnd, 
  onCancel, 
  formatTime, 
  formatRemainingTime, 
  getStatusColor, 
  getTypeIcon, 
  isMeetingTimeValid 
}: MeetingCardProps) {
  const TypeIcon = getTypeIcon(meeting.meeting_type)
  const isActive = meeting.status === 'in-progress'
  const canStart = meeting.status === 'scheduled' && isMeetingTimeValid(meeting)

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
            {meeting.status === 'in-progress' && meetingTimers[meeting.id] ? (
              <span className={`font-medium ${
                meetingTimers[meeting.id].remaining <= 30000 ? 'text-red-600' : 'text-green-600'
              }`}>
                {formatRemainingTime(meetingTimers[meeting.id].remaining)}
              </span>
            ) : (
              <span>{formatTime(meeting.start_time)} - {formatTime(meeting.end_time)}</span>
            )}
          </div>
          <span className="text-gray-500">
            {meeting.status === 'in-progress' && meetingTimers[meeting.id] 
              ? (() => {
                  const remaining = meetingTimers[meeting.id].remaining
                  const minutes = Math.floor(remaining / 60000)
                  const seconds = Math.floor((remaining % 60000) / 1000)
                  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
                })()
              : `${meeting.duration_minutes} min`
            }
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {meeting.status === 'scheduled' && canStart && (
            <Button 
              size="sm" 
              onClick={() => onStart(meeting.id)}
              className="flex-1"
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
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
  // Use Meeting Context instead of local state
  const { 
    meetings, 
    isLoading: loading, 
    startNewMeeting, 
    endCurrentMeeting,
    refreshMeetings,
    connectionStatus 
  } = useMeeting()
  
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meetingTimers, setMeetingTimers] = useState<Record<number, { remaining: number; endTime: Date }>>({})
  const isProcessingAutoEnd = useRef(false)
  
  // Add meeting form state
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    duration: 30, // Default 30 minutes
    type: 'video' as Meeting['meeting_type']
  })
  const [customTitle, setCustomTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [canCreateNewMeeting, setCanCreateNewMeeting] = useState(true)
  const [createMeetingReason, setCreateMeetingReason] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(9)
  const [totalMeetings, setTotalMeetings] = useState(0)

  // Update current time and meeting timers every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now)
      
                      // Update meeting timers and auto-end expired meetings
         setMeetingTimers(prev => {
           const updated = { ...prev }
           const expiredMeetings: number[] = []
           
           Object.keys(updated).forEach(meetingId => {
             const meetingIdNum = parseInt(meetingId)
             const timer = updated[meetingIdNum]
             if (timer) {
               const remaining = timer.endTime.getTime() - now.getTime()
               
               if (remaining <= 0) {
                 // Timer expired, mark for auto-end
                 if (!expiredMeetings.includes(meetingIdNum)) {
                   expiredMeetings.push(meetingIdNum)
                 }
                 delete updated[meetingIdNum]
               } else {
                 updated[meetingIdNum] = {
                   remaining,
                   endTime: timer.endTime
                 }
               }
             }
           })
           
           // Also check meetings that might have expired but aren't in timer state
           meetings.forEach(meeting => {
             if (meeting.status === 'in-progress' && !updated[meeting.id]) {
               const remaining = calculateRemainingTime(meeting)
               if (remaining !== null && remaining <= 0) {
                 if (!expiredMeetings.includes(meeting.id)) {
                   expiredMeetings.push(meeting.id)
                 }
               }
             } else if (meeting.status !== 'in-progress' && updated[meeting.id]) {
               // Remove from timer state if meeting is no longer in-progress
               delete updated[meeting.id]
             }
           })
           
           // Auto-end expired meetings (handle async operations outside setState)
           if (expiredMeetings.length > 0 && !isProcessingAutoEnd.current) {
             console.log(`Found ${expiredMeetings.length} expired meetings to auto-end:`, expiredMeetings)
             isProcessingAutoEnd.current = true
             // Use setTimeout to handle async operations after state update
             setTimeout(async () => {
                       // Get fresh meeting data to avoid race conditions
        // Use meetings from context instead of making API call
        const currentMeetings = meetings
        const processedMeetings = new Set()
               
               for (const meetingId of expiredMeetings) {
                 // Skip if we've already processed this meeting
                 if (processedMeetings.has(meetingId)) {
                   console.log(`Meeting ${meetingId} already processed, skipping`)
                   continue
                 }
                 
                 processedMeetings.add(meetingId)
                 try {
                   // Check current meeting status before attempting to end
                   const meeting = currentMeetings.find(m => m.id === meetingId)
                   
                   if (meeting && meeting.status === 'in-progress') {
                     console.log(`Auto-ending meeting ${meetingId} (status: ${meeting.status})`)
                     const { endMeeting } = await import('@/lib/meeting-utils')
                     await endMeeting(meetingId)
                     console.log(`Successfully auto-ended meeting ${meetingId}`)
                   } else if (meeting) {
                     // Meeting exists but is not in-progress (might already be completed)
                     console.log(`Meeting ${meetingId} is already ${meeting.status}, skipping auto-end`)
                   } else {
                     console.log(`Meeting ${meetingId} not found in current meetings list`)
                   }
                 } catch (error) {
                   console.error(`Error auto-ending meeting ${meetingId}:`, error)
                 }
               }
               
                             // Refresh meetings list after auto-ending
              setTimeout(async () => {
                try {
                  await refreshMeetings()
                } catch (error) {
                  console.error('Error refreshing meetings after auto-end:', error)
                }
                // Reset the processing flag
                isProcessingAutoEnd.current = false
              }, 1000)
             }, 100)
           }
           
           return updated
         })
    }, 1000) // Update every second for real-time countdown
    return () => clearInterval(timer)
  }, [])

  // Calculate timers for active meetings (called when meetings data changes)
  const updateMeetingTimers = () => {
    const activeTimers: Record<number, { remaining: number; endTime: Date }> = {}
    
    meetings.forEach(meeting => {
      if (meeting.status === 'in-progress') {
        const remaining = calculateRemainingTime(meeting)
        if (remaining && remaining > 0) {
          activeTimers[meeting.id] = {
            remaining,
            endTime: new Date(meeting.end_time)
          }
        }
      }
    })
    
    setMeetingTimers(activeTimers)
  }

  // Update meeting timers when meetings data changes
  useEffect(() => {
    updateMeetingTimers()
    setTotalMeetings(meetings.length)
  }, [meetings])

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

  const formatRemainingTime = (milliseconds: number) => {
    const totalMinutes = Math.floor(milliseconds / 60000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    
    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`
    } else {
      return `${seconds}s remaining`
    }
  }

  // Calculate remaining time for a meeting based on actual_start_time
  const calculateRemainingTime = (meeting: Meeting) => {
    if (meeting.status !== 'in-progress' || !meeting.actual_start_time) {
      return null
    }
    
    const now = new Date()
    const actualStartTime = new Date(meeting.actual_start_time)
    const endTime = new Date(meeting.end_time)
    const remaining = endTime.getTime() - now.getTime()
    
    return remaining > 0 ? remaining : 0
  }

  const isMeetingTimeValid = (meeting: Meeting) => {
    const now = currentTime
    const meetingStart = new Date(meeting.start_time)
    const meetingEnd = new Date(meeting.end_time)
    
    // Allow meetings to start if we're within 5 minutes of the start time
    const timeDiffMinutes = Math.abs(now.getTime() - meetingStart.getTime()) / 1000 / 60
    const isWithinStartWindow = timeDiffMinutes <= 5
    
    return (now >= meetingStart && now <= meetingEnd) || isWithinStartWindow
  }

  const handleStartMeeting = async (meetingId: number) => {
    try {
      const { startMeeting } = await import('@/lib/meeting-utils')
      await startMeeting(meetingId)
      
      // Context will auto-refresh via real-time updates
      await refreshMeetings()

      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

      console.log('Meeting started:', meetingId)
    } catch (error) {
      console.error('Error starting meeting:', error)
      setError('Failed to start meeting')
    }
  }

  const handleEndMeeting = async (meetingId: number) => {
    try {
      const { endMeeting } = await import('@/lib/meeting-utils')
      await endMeeting(meetingId)
      
      // Clear timer for this meeting
      setMeetingTimers(prev => {
        const updated = { ...prev }
        delete updated[meetingId]
        return updated
      })

      // Context will auto-refresh via real-time updates
      await refreshMeetings()

      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

      console.log('Meeting ended:', meetingId)
    } catch (error) {
      console.error('Error ending meeting:', error)
      setError('Failed to end meeting')
    }
  }

  const handleCancelMeeting = async (meetingId: number) => {
    try {
      const { cancelMeeting } = await import('@/lib/meeting-utils')
      await cancelMeeting(meetingId)
      
      // Context will auto-refresh via real-time updates
      await refreshMeetings()

      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

      console.log('Meeting cancelled:', meetingId)
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
      if (!newMeeting.title || newMeeting.duration <= 0) {
        setDialogError('Please fill in all required fields')
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

      // Calculate start and end times based on current time
      const now = new Date()
      const startTime = now.toTimeString().slice(0, 5) // HH:MM format
      const endTime = new Date(now.getTime() + newMeeting.duration * 60000).toTimeString().slice(0, 5)

      // Determine the actual title to use
      const actualTitle = newMeeting.title === 'custom' ? customTitle : newMeeting.title

      // Create new meeting via context (which also handles refresh)
      const result = await startNewMeeting(
        actualTitle,
        newMeeting.description,
        newMeeting.duration
      )

      if (!result.success) {
        setDialogError(result.message || 'Failed to create meeting')
        return
      }

      // Update can-create status
      const canCreateResult = await canCreateMeeting()
      setCanCreateNewMeeting(canCreateResult.canCreate)
      setCreateMeetingReason(canCreateResult.reason || null)

      // Reset form
      setNewMeeting({
        title: '',
        description: '',
        duration: 30,
        type: 'video'
      })
      setCustomTitle('')

      // Close dialog
      setShowAddForm(false)

      console.log('Meeting added successfully')
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
      duration: 30,
      type: 'video'
    })
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
                    meetingTimers={meetingTimers}
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    formatRemainingTime={formatRemainingTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isMeetingTimeValid={isMeetingTimeValid}
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
                    meetingTimers={meetingTimers}
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    formatRemainingTime={formatRemainingTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isMeetingTimeValid={isMeetingTimeValid}
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
                    meetingTimers={meetingTimers}
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    formatRemainingTime={formatRemainingTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isMeetingTimeValid={isMeetingTimeValid}
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
                    meetingTimers={meetingTimers}
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    formatRemainingTime={formatRemainingTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isMeetingTimeValid={isMeetingTimeValid}
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
                    meetingTimers={meetingTimers}
                    onStart={handleStartMeeting}
                    onEnd={handleEndMeeting}
                    onCancel={handleCancelMeeting}
                    formatTime={formatTime}
                    formatRemainingTime={formatRemainingTime}
                    getStatusColor={getStatusColor}
                    getTypeIcon={getTypeIcon}
                    isMeetingTimeValid={isMeetingTimeValid}
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

              {/* Duration */}
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Select
                  value={newMeeting.duration.toString()}
                  onValueChange={(value) => setNewMeeting(prev => ({ ...prev, duration: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Meeting will start now and end after the selected duration
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
