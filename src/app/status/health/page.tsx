"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { 
  Heart, 
  Clock, 
  User, 
  MapPin,
  Coffee,
  CheckCircle,
  Bell,
  ArrowLeft,
  Calendar,
  Filter,
  Settings,
  AlertCircle,
  Loader2,
  Search,
  X
} from "lucide-react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useHealthCheckSocketContext, HealthCheckRecord } from "@/hooks/use-health-check-socket-context"
import { useHealth } from "@/contexts/health-context"
import { getCurrentUser } from "@/lib/ticket-utils"

export default function HealthPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showNotification, setShowNotification] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [showAllHealthChecks, setShowAllHealthChecks] = useState(false)
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [complaint, setComplaint] = useState("")
  const [symptoms, setSymptoms] = useState("")
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoingToClinicLoading, setIsGoingToClinicLoading] = useState(false)
  const [isDoneLoading, setIsDoneLoading] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCanceling, setIsCanceling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [requestToCancel, setRequestToCancel] = useState<number | null>(null)

  // Get current user
  useEffect(() => {
    const user = getCurrentUser()
    if (user) {
      setCurrentUser(user)
    }
  }, [])

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Use health check socket hook
  const {
    isConnected,
    records,
    availability,
    isLoadingAvailability,
    userRequests,
    isLoadingRequests,
    fetchRecords,
    fetchAvailability,
    fetchUserRequests,
    createRequest,
    isNurseOnDuty,
    hasPendingRequest,
    updateGoingToClinic,
    updateInClinic,
    updateDone,
    cancelRequest
  } = useHealthCheckSocketContext(currentUser?.email || null)

  // Use health context
  const {
    isGoingToClinic,
    isInClinic,
    currentHealthRequest,
    setCurrentHealthRequest,
    handleGoingToClinic,
    handleBackToStation
  } = useHealth()

  // Fetch data on mount
  useEffect(() => {
    if (currentUser?.id) {
      fetchRecords(currentUser.id, 10, 0)
      fetchAvailability(1) // Fetch nurse_id 1 availability
      fetchUserRequests(currentUser.id) // Fetch user requests on mount
    }
  }, [currentUser?.id, fetchRecords, fetchAvailability, fetchUserRequests])

  // Function to handle fetching history
  const handleFetchHistory = async () => {
    if (!currentUser?.id) return
    
    setIsLoadingHistory(true)
    try {
      await fetchUserRequests(currentUser.id)
      setSearchQuery("") // Reset search when opening modal
      setShowHistoryModal(true)
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Function to handle canceling a health check request
  const handleCancelRequest = async (requestId: number) => {
    setIsCanceling(true)
    try {
      await cancelRequest(requestId)
      setShowCancelDialog(false)
      setRequestToCancel(null)
      
      // Show success notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('health-check-notification', {
          detail: {
            type: 'success',
            title: 'Request Canceled',
            message: 'Your health check request has been canceled successfully.'
          }
        }))
      }
    } catch (error) {
      console.error('Error canceling request:', error)
      
      // Show error notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('health-check-notification', {
          detail: {
            type: 'error',
            title: 'Cancel Failed',
            message: 'Failed to cancel the health check request. Please try again.'
          }
        }))
      }
    } finally {
      setIsCanceling(false)
    }
  }

  // Filter requests based on search query
  const filteredRequests = userRequests?.filter((request) => {
    if (!searchQuery.trim()) return true
    
    const query = searchQuery.toLowerCase()
    return (
      request.complaint.toLowerCase().includes(query) ||
      (request.symptoms && request.symptoms.toLowerCase().includes(query)) ||
      request.status.toLowerCase().includes(query) ||
      request.priority.toLowerCase().includes(query)
    )
  }) || []

  // Periodic refresh of user requests to ensure data stays in sync
  useEffect(() => {
    if (!currentUser?.id) return

    const interval = setInterval(() => {
      fetchUserRequests(currentUser.id)
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [currentUser?.id, fetchUserRequests])


  // Check nurse status
  const nurseStatus = isNurseOnDuty(1) // nurse_id 1
  const nurseOnDuty = nurseStatus && typeof nurseStatus === 'object' ? nurseStatus.onDuty : false
  const nurseOnBreak = nurseStatus && typeof nurseStatus === 'object' ? nurseStatus.onBreak : false
  const isNurseStatusLoading = nurseStatus === null // null means still loading

  // Check if user has pending request (only truly pending, not approved)
  const userHasPendingRequest = currentUser?.id ? 
    userRequests.some(request => 
      request.user_id === currentUser.id && request.status === 'pending'
    ) : false

  // Get the current approved or completed request
  const currentApprovedRequest = userRequests.find(req => 
    req.user_id === currentUser?.id && (req.status === 'approved' || req.status === 'completed')
  )


  // Set current health request when approved
  useEffect(() => {
    if (currentApprovedRequest && !currentHealthRequest) {
      setCurrentHealthRequest(currentApprovedRequest)
    }
  }, [currentApprovedRequest, currentHealthRequest, setCurrentHealthRequest])

  // Reset requestSent state when request is no longer pending
  useEffect(() => {
    if (requestSent && !userHasPendingRequest) {
      setRequestSent(false)
    }
  }, [requestSent, userHasPendingRequest])

  // Handle going to clinic
  const handleGoingToClinicClick = async () => {
    if (!currentApprovedRequest) {
      return
    }
    
    setIsGoingToClinicLoading(true)
    try {
      await updateGoingToClinic(currentApprovedRequest.id, true)
      await handleGoingToClinic()
    } catch (error) {
      console.error('Error updating going to clinic status:', error)
    } finally {
      setIsGoingToClinicLoading(false)
    }
  }

  // Handle back to station (Done button)
  const handleBackToStationClick = async () => {
    if (!currentApprovedRequest) return
    
    setIsDoneLoading(true)
    try {
      await updateDone(currentApprovedRequest.id, true)
      
      // Add a small delay to ensure the loading state is visible
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await handleBackToStation()
    } catch (error) {
      console.error('Error updating done status:', error)
    } finally {
      setIsDoneLoading(false)
    }
  }

  // Get current nurse availability
  const currentDayOfWeek = new Date().getDay()
  const todayAvailability = availability.find(avail => 
    avail.nurse_id === 1 && avail.day_of_week === currentDayOfWeek
  )

  const handleRequestHealthCheck = async () => {
    if (!currentUser?.id || !complaint.trim()) return
    
    setIsSubmitting(true)
    try {
      await createRequest({
        user_id: currentUser.id,
        complaint: complaint.trim(),
        symptoms: symptoms.trim() || undefined,
        priority
      })
      
      setRequestSent(true)
      setShowRequestForm(false)
      setComplaint("")
      setSymptoms("")
      setPriority('normal')
      
    } catch (error) {
      console.error('Error creating health check request:', error)
      // Show error notification
      setShowNotification(true)
      setTimeout(() => {
        setShowNotification(false)
      }, 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartNewRequest = () => {
    // Clear any previous status when starting a new request
    setRequestSent(false)
    setShowRequestForm(true)
  }

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  // Filter health check records based on date
  const filteredRecords = dateFilter 
    ? records.filter(record => {
        const recordDate = new Date(record.visit_date)
        return recordDate.toDateString() === dateFilter.toDateString()
      })
    : records

  // Recent health check records (last 3)
  const recentRecords = records.slice(0, 3)

  // Render component for a health check record
  const HealthCheckRecord = ({ record, index }: { record: HealthCheckRecord, index: number }) => (
    <div key={index} className="p-6 border rounded-xl bg-card ">
      <div className="space-y-6">
        {/* Header Row */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-lg">
                {new Date(record.visit_date).toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </h4>
              <p className="text-sm text-muted-foreground">{record.visit_time}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-sm font-medium">
                {record.nurse_first_name && record.nurse_last_name ? 
                  `${record.nurse_first_name[0]}${record.nurse_last_name[0]}` : 
                  record.nurse_first_name?.[0] || 'N'
                }
              </AvatarFallback>
            </Avatar>
            <div className="text-right">
              <p className="text-sm font-medium">
                {record.nurse_first_name && record.nurse_last_name ? 
                  `${record.nurse_first_name} ${record.nurse_last_name}` : 
                  record.nurse_first_name || 'Nurse'
                }
              </p>
              <p className="text-xs text-muted-foreground">Attending Nurse</p>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-3">
            <h5 className="font-medium text-sm uppercase tracking-wide">Chief Complaint</h5>
            <p className="text-xs font-medium text-muted-foreground ">{record.chief_complaint}</p>
          </div>

          <div className="space-y-3">
            <h5 className="font-medium text-sm uppercase tracking-wide">Medicines Issued</h5>
            <div className="text-xs font-medium text-muted-foreground ">
              {record.medicines_issued ? (
                <p className="text-xs">{record.medicines_issued}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No medicines prescribed</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-medium text-sm uppercase tracking-wide">Supplies Issued</h5>
            <div className="text-xs font-medium text-muted-foreground ">
              {record.supplies_issued ? (
                <p className="text-xs">{record.supplies_issued}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">No supplies issued</p>
              )}
            </div>
          </div>
        </div>

        {/* Follow-up Section */}
        {record.follow_up_required && (
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </div>
              <h5 className="font-medium text-sm text-orange-500 uppercase tracking-wide">Follow-up Required</h5>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h6 className="text-sm font-medium uppercase">Follow-up Date</h6>
                {record.follow_up_date ? (
                  <p className="text-xs font-medium  text-orange-700 dark:text-orange-300">
                    {new Date(record.follow_up_date).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not scheduled yet</p>
                )}
              </div>
              <div className="space-y-2">
                <h6 className="text-sm font-medium uppercase">Follow-up Notes</h6>
                {record.follow_up_notes ? (
                  <p className="text-xs text-orange-700 dark:text-orange-300">
                    {record.follow_up_notes}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No specific instructions</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // All Health Checks View
  if (showAllHealthChecks) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllHealthChecks(false)}
                  className="flex items-center gap-2 hover:!bg-transparent dark:hover:text-white hover:text-black"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">All Health Checks</h1>
                  <p className="text-muted-foreground">Complete history of your medical consultations</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {currentTime.toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  })}
                </span>
              </div>
            </div>

            {/* Date Filter */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filter Health Checks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium">Filter by Date:</label>
                  </div>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[280px] justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFilter ? format(dateFilter, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFilter}
                        onSelect={setDateFilter}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {dateFilter && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDateFilter(undefined)}
                    >
                      Clear Filter
                    </Button>
                  )}
                  
                  <div className="ml-auto text-sm text-muted-foreground">
                    Showing {filteredRecords.length} of {records.length} records
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Health Checks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5" />
                  Health Check Records
                </CardTitle>
                <CardDescription>
                  {dateFilter ? `Health checks for ${format(dateFilter, "PPP")}` : "All your health check records"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record, index) => (
                      <HealthCheckRecord key={index} record={record} index={index} />
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h4 className="font-medium text-lg mb-2">No Health Checks Found</h4>
                      <p className="text-sm text-muted-foreground">
                        {dateFilter ? "No health checks found for the selected date." : "Your health check history is empty."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  // Main Health Check View
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2 relative">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Health Check</h1>
              <p className="text-muted-foreground">Access medical assistance and health services</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {currentTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit',
                  hour12: true 
                })}
              </span>
            </div>
          </div>

          {/* Error Notification Only */}
          {showNotification && (
            <Card className="border-2 border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-500 text-white">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-red-800">
                      Error Submitting Request
                    </h4>
                    <p className="text-sm text-red-700">
                      There was an error submitting your request. Please try again.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Nurse Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-lg font-semibold">
                      {todayAvailability?.nurse_first_name?.[0]?.toUpperCase() || 'N'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">
                      {todayAvailability ? `${todayAvailability.nurse_first_name || 'Nurse'} ${todayAvailability.nurse_last_name || ''}` : 'Nurse'}
                    </CardTitle>
                    <CardDescription>Medical Officer on Duty</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={isLoadingAvailability || isNurseStatusLoading ? "secondary" : (nurseOnDuty ? (nurseOnBreak ? "secondary" : "default") : "outline")}>
                      <div className="flex items-center gap-1">
                        {isLoadingAvailability || isNurseStatusLoading ? (
                          <>
                            <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            Checking...
                          </>
                        ) : nurseOnDuty ? (
                          nurseOnBreak ? (
                            <>
                              <Coffee className="h-3 w-3" />
                              On Break
                            </>
                          ) : (
                            <>
                              <User className="h-3 w-3" />
                              On Duty
                            </>
                          )
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            Off Duty
                          </>
                        )}
                      </div>
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Shift:</span>
                    <span className="text-sm font-medium">
                      {isLoadingAvailability || isNurseStatusLoading ? 'Checking...' : (todayAvailability ? `${formatTime(todayAvailability.shift_start)} - ${formatTime(todayAvailability.shift_end)}` : 'Not Available')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Location:</span>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <MapPin className="h-3 w-3" />
                      Unit 2 Clinic
                    </div>
                  </div>

                </div>

                {todayAvailability?.break_start && todayAvailability?.break_end && (
                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground space-y-1">
                      {todayAvailability.break_start && todayAvailability.break_end && (
                        <p>• Break: {formatTime(todayAvailability.break_start)} - {formatTime(todayAvailability.break_end)}</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Request Health Check Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  Request Health Check
                </CardTitle>
                <CardDescription>
                  Submit a request for medical assistance or consultation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!showRequestForm ? (
                  <>
                    <div className="space-y-3">
                      <div className="p-3 bg-muted rounded-lg">
                        <h4 className="font-medium text-sm mb-2">Clinic Information</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            <span>Unit 2, left side of black room</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            <span>
                              Available: {isLoadingAvailability || isNurseStatusLoading ? 'Checking...' : (todayAvailability ? `${formatTime(todayAvailability.shift_start)} - ${formatTime(todayAvailability.shift_end)}` : 'Not Available')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {isLoadingAvailability || isNurseStatusLoading ? (
                         <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                           <div className="flex items-center gap-2">
                             <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                             <p className="text-sm text-blue-800">
                               Verifying if {todayAvailability ? `${todayAvailability.nurse_first_name || 'Nurse'} ${todayAvailability.nurse_last_name || ''}` : 'Nurse'} is on duty...
                             </p>
                           </div>
                         </div>
                       ) : !nurseOnDuty ? (
                        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <p className="text-sm text-orange-800">
                            <strong>Notice:</strong> {todayAvailability ? `${todayAvailability.nurse_first_name || 'Nurse'} ${todayAvailability.nurse_last_name || ''}` : 'Nurse'} is currently off duty. Health check requests can only be processed during shift hours (6:00 AM - 3:00 PM).
                          </p>
                        </div>
                      ) : null}

                                             {nurseOnDuty && nurseOnBreak && (
                         <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                           <p className="text-sm text-blue-800">
                             <strong>Notice:</strong> {todayAvailability ? `${todayAvailability.nurse_first_name || 'Nurse'} ${todayAvailability.nurse_last_name || ''}` : 'Nurse'} is currently on break. Your request will be processed when he returns.
                           </p>
                         </div>
                       )}

                       {userHasPendingRequest && !currentApprovedRequest && (
                         <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                           <p className="text-sm text-yellow-800">
                             <strong>Notice:</strong> You already have a pending health check request. Please wait for it to be processed before submitting a new one.
                           </p>
                         </div>
                       )}
                    </div>

                    {/* Show different buttons based on request status */}
                    {currentApprovedRequest && !currentApprovedRequest.done ? (
                      <div className="space-y-3">
                        {/* Show Done button when status is completed and done is false */}
                        {currentApprovedRequest.status === 'completed' && !currentApprovedRequest.done ? (
                          <Button 
                            onClick={handleBackToStationClick}
                            disabled={isDoneLoading}
                            className="w-full"
                            size="lg"
                            variant="default"
                          >
                            {isDoneLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Done - Back to Station
                              </>
                            )}
                          </Button>
                        ) : currentApprovedRequest.done ? (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800 text-center">
                              <strong>Completed:</strong> You have completed your health check and returned to station. Activity tracking has resumed.
                            </p>
                          </div>
                        ) : isDoneLoading ? (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                              <p className="text-sm text-blue-800">
                                <strong>Processing...</strong> Completing your health check...
                              </p>
                            </div>
                          </div>
                        ) : !currentApprovedRequest.going_to_clinic && !currentApprovedRequest.in_clinic ? (
                          <Button 
                            onClick={handleGoingToClinicClick}
                            disabled={isGoingToClinicLoading}
                            className="w-full"
                            size="lg"
                            variant="default"
                          >
                            {isGoingToClinicLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <MapPin className="mr-2 h-4 w-4" />
                                Going to Clinic
                              </>
                            )}
                          </Button>
                        ) : currentApprovedRequest.in_clinic ? (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800 text-center">
                              <strong>In Clinic:</strong> You are currently in the clinic. Please wait for the nurse to complete your health check.
                            </p>
                          </div>
                        ) : isGoingToClinicLoading ? (
                          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-orange-600" />
                              <p className="text-sm text-orange-800">
                                <strong>Processing...</strong> Updating your status...
                              </p>
                            </div>
                          </div>
                        ) : currentApprovedRequest.going_to_clinic && !currentApprovedRequest.in_clinic ? (
                          <div className="space-y-3">
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <p className="text-sm text-yellow-800 text-center">
                                <strong>Going to Clinic:</strong> You are on your way to the clinic. Please proceed to Unit 2.
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRequestToCancel(currentApprovedRequest.id)
                                setShowCancelDialog(true)
                              }}
                              disabled={isCanceling}
                              className="w-full"
                            >
                              {isCanceling ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Canceling...
                                </>
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel Request
                                </>
                              )}
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <Button 
                        onClick={handleStartNewRequest}
                        disabled={isLoadingAvailability || isNurseStatusLoading || !nurseOnDuty || userHasPendingRequest || (currentApprovedRequest && !currentApprovedRequest.done)}
                        className="w-full"
                        size="lg"
                      >
                        <Bell className="mr-2 h-4 w-4" />
                        {isLoadingAvailability || isNurseStatusLoading ? "Checking Availability..." : 
                         userHasPendingRequest ? "Request Pending" : 
                         (currentApprovedRequest && !currentApprovedRequest.done) ? "Request in Progress" :
                         "Request Health Check"}
                      </Button>
                    )}

                    {/* Show status and cancel button for pending requests */}
                    {userHasPendingRequest && (
                      <div className="space-y-3">
                        {/* Cancel button for pending requests - shown first */}
                        {(() => {
                          // Find the most recent pending request for this user
                          const userRequestsForUser = userRequests.filter(req => req.user_id === currentUser?.id)
                          const latestPendingRequest = userRequestsForUser
                            .filter(req => req.status === 'pending')
                            .sort((a, b) => new Date(b.request_time).getTime() - new Date(a.request_time).getTime())[0]
                          
                          if (latestPendingRequest) {
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRequestToCancel(latestPendingRequest.id)
                                  setShowCancelDialog(true)
                                }}
                                disabled={isCanceling}
                                className="w-full"
                              >
                                {isCanceling ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Canceling...
                                  </>
                                ) : (
                                  <>
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel Request
                                  </>
                                )}
                              </Button>
                            )
                          }
                          return null
                        })()}
                        
                        <p className="text-sm text-center text-muted-foreground">
                          {(() => {
                            // Get the latest pending request for this user
                            const userRequestsForUser = userRequests.filter(req => req.user_id === currentUser?.id)
                            const latestPendingRequest = userRequestsForUser
                              .filter(req => req.status === 'pending')
                              .sort((a, b) => new Date(b.request_time).getTime() - new Date(a.request_time).getTime())[0]
                            
                            if (latestPendingRequest?.status === 'pending') {
                              return "Your health check request has been submitted. Please wait for approval."
                            }
                            return "Your health check request has been submitted. Please wait for approval."
                          })()}
                        </p>
                      </div>
                    )}

                    {/* Show status for non-pending requests when there's no approved request */}
                    {(requestSent || userRequests.some(req => req.user_id === currentUser?.id && ['rejected', 'cancelled'].includes(req.status))) && !currentApprovedRequest && !userHasPendingRequest && (
                      <div className="space-y-3">
                        <p className="text-sm text-center text-muted-foreground">
                          {(() => {
                            // Get the latest request status (most recent by request_time)
                            const userRequestsForUser = userRequests.filter(req => req.user_id === currentUser?.id)
                            const latestRequest = userRequestsForUser.sort((a, b) => 
                              new Date(b.request_time).getTime() - new Date(a.request_time).getTime()
                            )[0]
                            if (latestRequest?.status === 'rejected') {
                              return "Your health check request has been rejected. Please contact the nurse for more information."
                            } else if (latestRequest?.status === 'cancelled') {
                              return "Your health check request has been cancelled."
                            }
                            return "Your health check request has been submitted. Please wait for approval."
                          })()}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Complaint/Issue *</label>
                      <Textarea
                        placeholder="Describe your health concern..."
                        value={complaint}
                        onChange={(e) => setComplaint(e.target.value)}
                        className="mt-1"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium">Symptoms (Optional)</label>
                      <Textarea
                        placeholder="List any symptoms you're experiencing..."
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">Priority</label>
                      <Select value={priority} onValueChange={(value) => setPriority(value as any)}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowRequestForm(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleRequestHealthCheck}
                        disabled={!complaint.trim() || isSubmitting}
                        className="flex-1"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Bell className="mr-2 h-4 w-4" />
                            Submit Request
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Your Recent Health Checks
                  </CardTitle>
                  <CardDescription>
                    History of your recent medical consultations and treatments
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleFetchHistory}
                    disabled={isLoadingHistory}
                    className="flex items-center gap-2"
                  >
                    {isLoadingHistory ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4" />
                        Request History
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAllHealthChecks(true)}
                    className="flex items-center gap-2"
                  >
                    <Heart className="h-4 w-4" />
                    View all Health checks
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentRecords.length > 0 ? (
                <Accordion type="multiple" className="w-full">
                  {recentRecords.map((record, index) => (
                    <AccordionItem key={index} value={`item-${index}`} className="border-b border-gray-200 dark:border-gray-700">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 text-left">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-green-600" />
                            <span className="font-medium">
                              {new Date(record.created_at).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm text-gray-500">
                              {new Date(record.created_at).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-4">
                        <HealthCheckRecord record={record} index={index} />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="text-center py-8">
                  <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h4 className="font-medium text-lg mb-2">No Recent Health Checks</h4>
                  <p className="text-sm text-muted-foreground">
                    Your health check history will appear here after your first visit to the clinic.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>


          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Health Services Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-medium">Available Services</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• General health consultation</li>
                    <li>• First aid and emergency care</li>
                    <li>• Blood pressure monitoring</li>
                    <li>• Minor injury treatment</li>
                    <li>• Health advice and wellness tips</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Emergency Procedures</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• For emergencies, contact security immediately</li>
                    <li>• Non-emergency requests through this system</li>
                    <li>• Response time: 5-10 minutes during duty hours</li>
                    <li>• All visits are confidential and documented</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request History Modal */}
        <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
          <DialogContent className="max-w-6xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Request History
              </DialogTitle>
              <DialogDescription>
                Your complete health check request history and their status
              </DialogDescription>
              <div className="pt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by complaint, symptoms, status, or priority..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing {filteredRequests.length} of {userRequests?.length || 0} requests
                  </p>
                )}
              </div>
            </DialogHeader>
            
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading requests...</span>
                </div>
              </div>
            ) : filteredRequests && filteredRequests.length > 0 ? (
              <ScrollArea className="h-[60vh] w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Complaint</TableHead>
                      <TableHead className="w-[120px]">Symptoms</TableHead>
                      <TableHead className="w-[140px]">Date/Time</TableHead>
                      <TableHead className="w-[160px]">Going to Clinic At</TableHead>
                      <TableHead className="w-[80px]">Priority</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-medium text-sm">{request.complaint}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {request.symptoms || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="space-y-1">
                            <div>
                              {new Date(request.request_time).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </div>
                            <div>
                              {new Date(request.request_time).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground">
                            {request.going_to_clinic_at ? (
                              <div className="space-y-1">
                                <div>
                                  {new Date(request.going_to_clinic_at).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </div>
                                <div>
                                  {new Date(request.going_to_clinic_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </div>
                            ) : (
                              '-'
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              request.priority === 'urgent' ? 'destructive' :
                              request.priority === 'high' ? 'destructive' :
                              request.priority === 'normal' ? 'default' :
                              'secondary'
                            }
                            className="text-xs"
                          >
                            {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              request.status === 'completed' ? 'default' :
                              request.status === 'pending' ? 'secondary' :
                              request.status === 'approved' ? 'default' :
                              request.status === 'rejected' ? 'destructive' :
                              request.status === 'cancelled' ? 'outline' : 'secondary'
                            }
                            className="text-xs"
                          >
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="font-medium text-lg mb-2">
                  {searchQuery ? 'No Matching Requests' : 'No Request History'}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {searchQuery 
                    ? 'Try adjusting your search terms to find what you\'re looking for.'
                    : 'Your health check request history will appear here.'
                  }
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="mt-4"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Health Check Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel your health check request? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCancelDialog(false)
                  setRequestToCancel(null)
                }}
                disabled={isCanceling}
              >
                Keep Request
              </Button>
              <Button
                variant="destructive"
                onClick={() => requestToCancel && handleCancelRequest(requestToCancel)}
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  'Cancel Request'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
} 