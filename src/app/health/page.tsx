"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  Settings
} from "lucide-react"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Input } from "@/components/ui/input"

export default function HealthPage() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showNotification, setShowNotification] = useState(false)
  const [requestSent, setRequestSent] = useState(false)
  const [showAllHealthChecks, setShowAllHealthChecks] = useState(false)
  const [dateFilter, setDateFilter] = useState("")

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Nurse Ron's shift: 6:00 AM - 3:00 PM
  const shiftStart = "06:00"
  const shiftEnd = "15:00"

  const isNurseOnDuty = () => {
    const now = currentTime
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    return currentTimeStr >= shiftStart && currentTimeStr < shiftEnd
  }

  // Simulate nurse break times (you can make this more sophisticated later)
  const isNurseOnBreak = () => {
    const now = currentTime
    const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    
    // Example break times: 10:00-10:15 (morning break), 12:00-13:00 (lunch)
    const morningBreakStart = "10:00"
    const morningBreakEnd = "10:15"
    const lunchBreakStart = "12:00"
    const lunchBreakEnd = "13:00"
    
    return (currentTimeStr >= morningBreakStart && currentTimeStr <= morningBreakEnd) ||
           (currentTimeStr >= lunchBreakStart && currentTimeStr <= lunchBreakEnd)
  }

  const handleRequestHealthCheck = () => {
    setRequestSent(true)
    setShowNotification(true)
    
    // Hide notification after 10 seconds
    setTimeout(() => {
      setShowNotification(false)
    }, 10000)
  }

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
    return `${displayHour}:${minutes} ${ampm}`
  }

  const nurseOnDuty = isNurseOnDuty()
  const nurseOnBreak = isNurseOnBreak()

  // Mock health check data - will be replaced with real data from external app
  const allHealthChecks = [
    {
      date: "2024-01-15",
      time: "10:30 AM",
      complaint: "Headache and mild fever",
      medicines: "Paracetamol 500mg (2 tablets)",
      supplies: "Thermometer reading chart",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2024-01-12",
      time: "3:20 PM",
      complaint: "Eye strain from computer work",
      medicines: "Eye drops (artificial tears)",
      supplies: "Computer usage guidelines sheet",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2024-01-10",
      time: "9:15 AM",
      complaint: "Back pain from sitting",
      medicines: "Ibuprofen 400mg",
      supplies: "Posture correction guide, Lumbar support cushion",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2024-01-08",
      time: "2:15 PM", 
      complaint: "Minor cut on finger",
      medicines: "Antiseptic solution",
      supplies: "Adhesive bandage, Gauze pad",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2024-01-05",
      time: "11:00 AM",
      complaint: "Seasonal allergies",
      medicines: "Antihistamine tablets",
      supplies: "Allergy management pamphlet",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2024-01-03",
      time: "11:45 AM",
      complaint: "Blood pressure check (routine)",
      medicines: "None",
      supplies: "BP monitoring card",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2023-12-28",
      time: "1:30 PM",
      complaint: "Stress and fatigue",
      medicines: "Vitamin B complex",
      supplies: "Stress management techniques guide",
      issuedBy: "Nurse Ron"
    },
    {
      date: "2023-12-20",
      time: "10:45 AM",
      complaint: "Mild cold symptoms",
      medicines: "Cough syrup, Vitamin C tablets",
      supplies: "Face mask, Hand sanitizer",
      issuedBy: "Nurse Ron"
    }
  ]

  // Recent health checks (last 3)
  const recentHealthChecks = allHealthChecks.slice(0, 3)

  // Filter health checks based on date
  const filteredHealthChecks = dateFilter 
    ? allHealthChecks.filter(record => record.date.includes(dateFilter))
    : allHealthChecks

  // Render component for a health check record
  const HealthCheckRecord = ({ record, index }: { record: any, index: number }) => (
    <div key={index} className="p-4 border rounded-lg bg-card">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div>
          <h5 className="font-medium text-sm text-muted-foreground mb-1">Date & Time</h5>
          <p className="text-sm font-medium">{new Date(record.date).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })}</p>
          <p className="text-xs text-muted-foreground">{record.time}</p>
        </div>
        <div>
          <h5 className="font-medium text-sm text-muted-foreground mb-1">Chief Complaint/Illness</h5>
          <p className="text-sm">{record.complaint}</p>
        </div>
        <div>
          <h5 className="font-medium text-sm text-muted-foreground mb-1">Medicines Issued</h5>
          <p className="text-sm">{record.medicines}</p>
        </div>
        <div>
          <h5 className="font-medium text-sm text-muted-foreground mb-1">Supplies Issued</h5>
          <p className="text-sm">{record.supplies}</p>
        </div>
        <div>
          <h5 className="font-medium text-sm text-muted-foreground mb-1">Issued By</h5>
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-blue-500 text-white text-xs">
                RN
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium">{record.issuedBy}</p>
          </div>
        </div>
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
            {/* Coming Soon Overlay */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-card border rounded-lg p-8 max-w-md mx-4 text-center shadow-lg">
                <div className="mb-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Settings className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
                  <p className="text-muted-foreground mb-6">
                    The Health Check feature is currently under development. 
                    We're working hard to bring you comprehensive health services.
                  </p>
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Digital health records</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Real-time nurse availability</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Appointment scheduling</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Health monitoring</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => window.history.back()}
                  className="w-full"
                >
                  Go Back
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllHealthChecks(false)}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Health Check
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
                    <label htmlFor="date-filter" className="text-sm font-medium">Filter by Date:</label>
                  </div>
                  <Input
                    id="date-filter"
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-auto"
                    placeholder="Select date"
                  />
                  {dateFilter && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDateFilter("")}
                    >
                      Clear Filter
                    </Button>
                  )}
                  <div className="ml-auto text-sm text-muted-foreground">
                    Showing {filteredHealthChecks.length} of {allHealthChecks.length} records
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
                  {dateFilter ? `Health checks for ${new Date(dateFilter).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}` : "All your health check records"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredHealthChecks.length > 0 ? (
                    filteredHealthChecks.map((record, index) => (
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
          {/* Coming Soon Overlay */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-card border rounded-lg p-8 max-w-md mx-4 text-center shadow-lg">
              <div className="mb-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Coming Soon</h2>
                <p className="text-muted-foreground mb-6">
                  The Health Check feature is currently under development. 
                  We're working hard to bring you comprehensive health services.
                </p>
                <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Digital health records</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Real-time nurse availability</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Appointment scheduling</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>Health monitoring</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
                className="w-full"
              >
                Go Back
              </Button>
            </div>
          </div>
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

          {/* Notification */}
          {showNotification && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500 text-white">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-medium text-green-800">Health Check Request Approved</h4>
                    <p className="text-sm text-green-700">
                      You may now go to the clinic at <strong>Unit 2 left side of black room</strong>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            {/* Nurse Ron Status Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-blue-500 text-white text-lg font-semibold">
                      RN
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-xl">Nurse Ron</CardTitle>
                    <CardDescription>Medical Officer on Duty</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge variant={nurseOnDuty ? (nurseOnBreak ? "secondary" : "default") : "outline"}>
                      <div className="flex items-center gap-1">
                        {nurseOnDuty ? (
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
                      {formatTime(shiftStart)} - {formatTime(shiftEnd)}
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

                <div className="pt-2">
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>• Morning Break: 10:00 AM - 10:15 AM</p>
                    <p>• Lunch Break: 12:00 PM - 1:00 PM</p>
                  </div>
                </div>
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
                        <span>Available: 6:00 AM - 3:00 PM</span>
                      </div>
                    </div>
                  </div>

                  {!nurseOnDuty && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-800">
                        <strong>Notice:</strong> Nurse Ron is currently off duty. Health check requests can only be processed during shift hours (6:00 AM - 3:00 PM).
                      </p>
                    </div>
                  )}

                  {nurseOnDuty && nurseOnBreak && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Notice:</strong> Nurse Ron is currently on break. Your request will be processed when he returns.
                      </p>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleRequestHealthCheck}
                  disabled={!nurseOnDuty || requestSent}
                  className="w-full"
                  size="lg"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  {requestSent ? "Request Sent" : "Request Health Check"}
                </Button>

                {requestSent && (
                  <p className="text-sm text-center text-muted-foreground">
                    Your health check request has been submitted. Please wait for approval.
                  </p>
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
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentHealthChecks.length > 0 ? (
                  recentHealthChecks.map((record, index) => (
                    <HealthCheckRecord key={index} record={record} index={index} />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="font-medium text-lg mb-2">No Recent Health Checks</h4>
                    <p className="text-sm text-muted-foreground">
                      Your health check history will appear here after your first visit to the clinic.
                    </p>
                  </div>
                )}
              </div>
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
      </SidebarInset>
    </SidebarProvider>
  )
} 