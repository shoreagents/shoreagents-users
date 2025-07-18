"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { 
  User, 
  Clock, 
  Phone, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle2,
  MapPin,
  Bell
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Nurse {
  id: string
  name: string
  avatar?: string
  department: string
  shift: string
  status: 'active' | 'break' | 'off-duty'
  location: string
  phone: string
  lastActive: string
  notifications: number
}

export default function HealthPage() {
  const [nurses, setNurses] = useState<Nurse[]>([])
  const [loading, setLoading] = useState(true)
  const [notifyingNurse, setNotifyingNurse] = useState<string | null>(null)
  const { toast } = useToast()

  // Mock data - in real app this would come from API
  useEffect(() => {
    const mockNurses: Nurse[] = [
      {
        id: "1",
        name: "Dr. Sarah Johnson",
        avatar: "/avatars/sarah.jpg",
        department: "Emergency Department",
        shift: "Day Shift (7AM - 7PM)",
        status: "active",
        location: "Emergency Room - Station A",
        phone: "+1 (555) 123-4567",
        lastActive: "2 minutes ago",
        notifications: 3
      },
      {
        id: "2",
        name: "Dr. Michael Chen",
        avatar: "/avatars/michael.jpg",
        department: "Intensive Care Unit",
        shift: "Night Shift (7PM - 7AM)",
        status: "active",
        location: "ICU - Station B",
        phone: "+1 (555) 234-5678",
        lastActive: "5 minutes ago",
        notifications: 1
      },
      {
        id: "3",
        name: "Dr. Emily Rodriguez",
        avatar: "/avatars/emily.jpg",
        department: "Pediatrics",
        shift: "Day Shift (7AM - 7PM)",
        status: "break",
        location: "Pediatric Ward - Station C",
        phone: "+1 (555) 345-6789",
        lastActive: "15 minutes ago",
        notifications: 0
      },
      {
        id: "4",
        name: "Dr. James Wilson",
        avatar: "/avatars/james.jpg",
        department: "Surgery",
        shift: "Day Shift (7AM - 7PM)",
        status: "active",
        location: "Operating Room 2",
        phone: "+1 (555) 456-7890",
        lastActive: "1 minute ago",
        notifications: 2
      }
    ]

    setNurses(mockNurses)
    setLoading(false)
  }, [])

  const handleNotifyNurse = async (nurseId: string, nurseName: string) => {
    setNotifyingNurse(nurseId)
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update nurse notifications count
      setNurses(prev => prev.map(nurse => 
        nurse.id === nurseId 
          ? { ...nurse, notifications: nurse.notifications + 1 }
          : nurse
      ))

      toast({
        title: "Notification Sent",
        description: `Dr. ${nurseName} has been notified that you're on your way.`,
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send notification. Please try again.",
        variant: "destructive",
      })
    } finally {
      setNotifyingNurse(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'break':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'off-duty':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4" />
      case 'break':
        return <Clock className="w-4 h-4" />
      case 'off-duty':
        return <AlertCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading health staff...</p>
        </div>
      </div>
    )
  }

  const activeNurses = nurses.filter(nurse => nurse.status === 'active')
  const onBreakNurses = nurses.filter(nurse => nurse.status === 'break')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Health Staff</h1>
          <p className="text-muted-foreground">
            View active nurses on duty and send notifications
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {activeNurses.length} Active
          </Badge>
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            {onBreakNurses.length} On Break
          </Badge>
        </div>
      </div>

      {/* Active Nurses Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Active Nurses on Duty
          </CardTitle>
          <CardDescription>
            Nurses currently available for assistance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeNurses.map((nurse) => (
              <Card key={nurse.id} className="border-l-4 border-l-green-500">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={nurse.avatar} alt={nurse.name} />
                        <AvatarFallback className="bg-green-100 text-green-700">
                          {nurse.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-lg">{nurse.name}</h3>
                        <p className="text-sm text-muted-foreground">{nurse.department}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(nurse.status)}>
                      {getStatusIcon(nurse.status)}
                      <span className="ml-1 capitalize">{nurse.status}</span>
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>{nurse.shift}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{nurse.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{nurse.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                      <span>{nurse.notifications} notifications</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleNotifyNurse(nurse.id, nurse.name)}
                      disabled={notifyingNurse === nurse.id}
                      className="flex-1"
                    >
                      {notifyingNurse === nurse.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Notifying...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Notify Nurse
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="icon">
                      <Phone className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Nurses on Break Section */}
      {onBreakNurses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              Nurses on Break
            </CardTitle>
            <CardDescription>
              Nurses currently on break but may be available for emergencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {onBreakNurses.map((nurse) => (
                <Card key={nurse.id} className="border-l-4 border-l-yellow-500 opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={nurse.avatar} alt={nurse.name} />
                          <AvatarFallback className="bg-yellow-100 text-yellow-700">
                            {nurse.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-lg">{nurse.name}</h3>
                          <p className="text-sm text-muted-foreground">{nurse.department}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(nurse.status)}>
                        {getStatusIcon(nurse.status)}
                        <span className="ml-1 capitalize">{nurse.status}</span>
                      </Badge>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{nurse.shift}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{nurse.location}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{nurse.phone}</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleNotifyNurse(nurse.id, nurse.name)}
                      disabled={notifyingNurse === nurse.id}
                    >
                      {notifyingNurse === nurse.id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                          Notifying...
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Emergency Contact
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common health-related actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-20 flex-col gap-2">
              <AlertCircle className="w-6 h-6" />
              <span>Emergency Alert</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <User className="w-6 h-6" />
              <span>Request Check-up</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2">
              <MessageSquare className="w-6 h-6" />
              <span>Health Consultation</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 