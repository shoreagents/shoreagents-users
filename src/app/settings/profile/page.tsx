"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  ArrowLeft, 
  User, 
  Calendar,
  Building,
  Shield,
  CheckCircle
} from "lucide-react"
import Link from "next/link"
import { ProfileSkeleton } from "@/components/skeleton-loaders"
import { useProfile, UserProfile } from "@/hooks/use-profile"

export default function ProfilePage() {
  const { profile, isLoading, error, isCached } = useProfile()
  
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
                  {isCached && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Cached
                    </span>
                  )}
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
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={profile.first_name}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={profile.last_name}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="middle_name">Middle Name</Label>
                      <Input
                        id="middle_name"
                        value={profile.middle_name || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nickname">Nickname</Label>
                      <Input
                        id="nickname"
                        value={profile.nickname || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gender">Gender</Label>
                      <Input
                        id="gender"
                        value={profile.gender || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        value={profile.phone || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input
                        id="date_of_birth"
                        value={profile.date_of_birth || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={profile.city || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={profile.address || ''}
                        disabled={true}
                      />
                    </div>
                  </div>
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
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="employee_id">Employee ID</Label>
                      <Input
                        id="employee_id"
                        value={profile.employee_id || profile.id_number}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="job_title">Job Title</Label>
                      <Input
                        id="job_title"
                        value={profile.job_title || profile.position}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user_type">User Type</Label>
                      <Input
                        id="user_type"
                        value={profile.user_type || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employment_status">Employment Status</Label>
                      <Input
                        id="employment_status"
                        value={profile.employment_status || profile.status}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hire_type">Hire Type</Label>
                      <Input
                        id="hire_type"
                        value={profile.hire_type || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="staff_source">Staff Source</Label>
                      <Input
                        id="staff_source"
                        value={profile.staff_source || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Start Date</Label>
                      <Input
                        id="start_date"
                        value={profile.start_date}
                        disabled={true}
                      />
                    </div>
                    {profile.exit_date && (
                      <div className="space-y-2">
                        <Label htmlFor="exit_date">Exit Date</Label>
                        <Input
                          id="exit_date"
                          value={profile.exit_date}
                          disabled={true}
                        />
                      </div>
                    )}
                  </div>
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
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="shift_period">Shift Period</Label>
                      <Input
                        id="shift_period"
                        value={profile.shift_period || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift_schedule">Shift Schedule</Label>
                      <Input
                        id="shift_schedule"
                        value={profile.shift_schedule || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="shift_time">Shift Time</Label>
                      <Input
                        id="shift_time"
                        value={profile.shift_time || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="work_setup">Work Setup</Label>
                      <Input
                        id="work_setup"
                        value={profile.work_setup || ''}
                        disabled={true}
                      />
                    </div>
                  </div>
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
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={profile.company}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="service">Service</Label>
                      <Input
                        id="service"
                        value={profile.service || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={profile.country || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="member_status">Member Status</Label>
                      <Input
                        id="member_status"
                        value={profile.member_status || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_phone">Company Phone</Label>
                      <Input
                        id="company_phone"
                        value={profile.company_phone || ''}
                        disabled={true}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={profile.website ? profile.website.toString() : ''}
                        disabled={true}
                      />
                    </div>
                  </div>
                  {profile.company_address && (
                    <div className="space-y-2">
                      <Label htmlFor="company_address">Company Address</Label>
                      <Input
                        id="company_address"
                        value={profile.company_address}
                        disabled={true}
                      />
                    </div>
                  )}
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
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 