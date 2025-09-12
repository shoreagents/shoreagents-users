"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { 
  ArrowLeft, 
  User, 
  Calendar,
  Building,
  Shield,
  CheckCircle,
  Mail,
  MapPin,
  Phone
} from "lucide-react"
import { ProfileSkeleton } from "@/components/skeleton-loaders"
import { useProfile, UserProfile } from "@/hooks/use-profile"
import { useTutorial } from "@/contexts/tutorial-context"

export default function ProfilePage() {
  const { profile, isLoading, error, isCached } = useProfile()
  const { startTutorial, resetTutorial } = useTutorial()
  
  const getInitials = (first?: string, last?: string, email?: string) => {
    const firstTrim = (first || '').trim()
    const lastTrim = (last || '').trim()
    if (firstTrim || lastTrim) {
      const a = firstTrim ? firstTrim[0] : ''
      const b = lastTrim ? lastTrim[0] : ''
      const initials = `${a}${b}` || (firstTrim.slice(0, 2))
      return initials.toUpperCase()
    }
    const mail = (email || '').trim()
    if (mail.includes('@')) {
      const [local, domain] = mail.split('@')
      const a = local?.[0] || ''
      const b = domain?.[0] || ''
      const initials = `${a}${b}`
      return initials ? initials.toUpperCase() : 'SA'
    }
    return 'SA'
  }

  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <ProfileSkeleton />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (error || !profile) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-muted-foreground">Profile Not Found</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {error || 'Unable to load profile information.'}
                </p>
                <Button 
                  onClick={() => window.location.reload()} 
                  className="mt-4"
                  variant="outline"
                >
                  Try Again
                </Button>
              </div>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
                <p className="text-muted-foreground">
                  Manage your personal information and account details
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Personal Information
                  </CardTitle>
                  <CardDescription>
                    Your basic personal details and contact information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" defaultValue="basic-info">
                    <AccordionItem value="basic-info">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span>Basic Information</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">First Name</p>
                            <p className="text-sm font-semibold">{profile.first_name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Last Name</p>
                            <p className="text-sm font-semibold">{profile.last_name}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Middle Name</p>
                            <p className="text-sm font-semibold">{profile.middle_name || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Nickname</p>
                            <p className="text-sm font-semibold">{profile.nickname || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Gender</p>
                            <p className="text-sm font-semibold">{profile.gender || 'Not specified'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="contact-info">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span>Contact Information</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Email Address</p>
                            <p className="text-sm font-semibold break-all">{profile.email}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                            <p className="text-sm font-semibold">{profile.phone || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Date of Birth</p>
                            <p className="text-sm font-semibold">{profile.date_of_birth || 'Not provided'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="location-info">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>Location Information</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">City</p>
                            <p className="text-sm font-semibold">{profile.city || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Address</p>
                            <p className="text-sm font-semibold">{profile.address || 'Not provided'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* Job Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Job Information
                  </CardTitle>
                  <CardDescription>
                    Your employment details and job information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" defaultValue="employment-details">
                    <AccordionItem value="employment-details">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>Employment Details</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Employee ID</p>
                            <p className="text-sm font-semibold">{profile.employee_id || profile.id_number || 'Not assigned'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Job Title</p>
                            <p className="text-sm font-semibold">{profile.job_title || profile.position || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">User Type</p>
                            <p className="text-sm font-semibold">{profile.user_type || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Employment Status</p>
                            <p className="text-sm font-semibold">{profile.employment_status || profile.status || 'Not specified'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="contract-details">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Contract Details</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Hire Type</p>
                            <p className="text-sm font-semibold">{profile.hire_type || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Staff Source</p>
                            <p className="text-sm font-semibold">{profile.staff_source || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                            <p className="text-sm font-semibold">{profile.start_date || 'Not specified'}</p>
                          </div>
                          {profile.exit_date && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">Exit Date</p>
                              <p className="text-sm font-semibold">{profile.exit_date}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* Schedule Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Schedule Information
                  </CardTitle>
                  <CardDescription>
                    Your work schedule and setup details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" defaultValue="work-schedule">
                    <AccordionItem value="work-schedule">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Work Schedule</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Shift Period</p>
                            <p className="text-sm font-semibold">{profile.shift_period || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Shift Schedule</p>
                            <p className="text-sm font-semibold">{profile.shift_schedule || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Shift Time</p>
                            <p className="text-sm font-semibold">{profile.shift_time || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Work Setup</p>
                            <p className="text-sm font-semibold">{profile.work_setup || 'Not specified'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>

              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-primary" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Your company and member details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full" defaultValue="company-details">
                    <AccordionItem value="company-details">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span>Company Details</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Company</p>
                            <p className="text-sm font-semibold">{profile.company || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Service</p>
                            <p className="text-sm font-semibold">{profile.service || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Country</p>
                            <p className="text-sm font-semibold">{profile.country || 'Not specified'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Member Status</p>
                            <p className="text-sm font-semibold">{profile.member_status || 'Not specified'}</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="contact-details">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span>Contact Details</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Company Phone</p>
                            <p className="text-sm font-semibold">{profile.company_phone || 'Not provided'}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Website</p>
                            <p className="text-sm font-semibold break-all">{profile.website ? profile.website.toString() : 'Not provided'}</p>
                          </div>
                          {profile.company_address && (
                            <div className="space-y-1 md:col-span-2">
                              <p className="text-sm font-medium text-muted-foreground">Company Address</p>
                              <p className="text-sm font-semibold">{profile.company_address}</p>
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Profile Picture */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Profile Picture</CardTitle>
                  <CardDescription>
                    Your profile photo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      {profile.profile_picture ? (
                        <img 
                          src={profile.profile_picture} 
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-xl font-semibold text-muted-foreground">
                            {getInitials(profile.first_name, profile.last_name, profile.email)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  {profile.company_logo && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground mb-2">Company Logo</p>
                      <img 
                        src={profile.company_logo} 
                        alt="Company Logo"
                        className="h-8 mx-auto"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Experience Points (for Agents) */}
              {profile.user_type === 'Agent' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Experience Points</CardTitle>
                    <CardDescription>
                      Your agent experience and progress
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-primary">
                        {profile.exp_points || 0}
                      </div>
                      <p className="text-sm text-muted-foreground">Total XP</p>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min(((profile.exp_points || 0) % 1000) / 10, 100)}%` 
                        }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      {1000 - ((profile.exp_points || 0) % 1000)} XP to next level
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Account Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Account Status</CardTitle>
                  <CardDescription>
                    Your current account information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Employment Status</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {profile.employment_status || profile.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Email Verified</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Verified
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Start Date</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{profile.start_date}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-orange-600" />
                      <span className="text-sm">User Type</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {profile.user_type}
                    </Badge>
                  </div>
                  {profile.member_status && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm">Member Status</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          profile.member_status === 'Current Client' 
                            ? 'border-green-500 text-green-700' 
                            : 'border-red-500 text-red-700'
                        }`}
                      >
                        {profile.member_status}
                      </Badge>
                    </div>
                  )}
                  {profile.exit_date && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-red-600" />
                        <span className="text-sm">Exit Date</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{profile.exit_date}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tutorial Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    App Tutorial
                  </CardTitle>
                  <CardDescription>
                    Take a guided tour of the main features
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                   <div className="flex gap-3">
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={startTutorial}
                         className="flex-1"
                       >
                         Start Tutorial
                       </Button>
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={resetTutorial}
                         className="flex-1"
                       >
                         Reset Tutorial
                       </Button>
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