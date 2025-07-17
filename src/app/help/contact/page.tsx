"use client"

import { useState, useEffect } from "react"
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
import { 
  ArrowLeft, 
  HelpCircle, 
  Mail, 
  Phone, 
  MessageSquare,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  Globe
} from "lucide-react"
import Link from "next/link"
import { HelpContactSkeleton } from "@/components/skeleton-loaders"

const supportChannels = [
  {
    title: "Submit Support Ticket",
    description: "Create a detailed support ticket for technical issues, equipment problems, or general inquiries.",
    icon: FileText,
    action: "Create Ticket",
    href: "/forms/new",
    priority: "high"
  },
  {
    title: "Email Support",
    description: "Send us an email for non-urgent inquiries or detailed questions.",
    icon: Mail,
    action: "Send Email",
    href: "mailto:support@shoreagents.com",
    priority: "medium"
  },
  {
    title: "Phone Support",
    description: "Call our support line for urgent issues that require immediate attention.",
    icon: Phone,
    action: "Call Now",
    href: "tel:+1-555-123-4567",
    priority: "high"
  },
  {
    title: "Live Chat",
    description: "Chat with our support team in real-time for quick questions and assistance.",
    icon: MessageSquare,
    action: "Start Chat",
    href: "#",
    priority: "medium"
  }
]

const supportHours = [
  { day: "Monday - Friday", hours: "8:00 AM - 6:00 PM EST" },
  { day: "Saturday", hours: "9:00 AM - 3:00 PM EST" },
  { day: "Sunday", hours: "Emergency Support Only" }
]

export default function ContactSupportPage() {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <HelpContactSkeleton />
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
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Contact Support</h1>
              <p className="text-muted-foreground">Get in touch with our support team through multiple channels</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Support Channels */}
              <div className="grid gap-4 md:grid-cols-2">
                {supportChannels.map((channel, index) => (
                  <Card key={index} className="relative">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <channel.icon className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{channel.title}</CardTitle>
                        </div>
                        {channel.priority === "high" && (
                          <Badge variant="destructive" className="text-xs">
                            Priority
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {channel.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={channel.href}>
                        <Button className="w-full">
                          {channel.action}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Contact Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Contact Information
                  </CardTitle>
                  <CardDescription>
                    Direct contact details for our support team
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email</span>
                      </div>
                      <p className="text-sm text-muted-foreground">support@shoreagents.com</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone</span>
                      </div>
                      <p className="text-sm text-muted-foreground">+1 (555) 123-4567</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Website</span>
                      </div>
                      <p className="text-sm text-muted-foreground">www.shoreagents.com</p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Response Time</span>
                      </div>
                      <p className="text-sm text-muted-foreground">24-48 hours</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Support Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Support Hours</CardTitle>
                  <CardDescription>
                    When our team is available
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {supportHours.map((schedule, index) => (
                    <div key={index} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{schedule.day}</span>
                      <span className="text-sm text-muted-foreground">{schedule.hours}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>
                    Common support tasks
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col gap-1">
                  <Link href="/forms/my-tickets">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      View My Tickets
                    </Button>
                  </Link>
                  <Link href="/help/faq">
                    <Button variant="outline" className="w-full justify-start">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Browse FAQ
                    </Button>
                  </Link>
                  <Link href="/help/docs">
                    <Button variant="outline" className="w-full justify-start">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Documentation
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Emergency Support */}
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="text-lg text-orange-800">Emergency Support</CardTitle>
                  <CardDescription className="text-orange-700">
                    For urgent issues outside business hours
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm text-orange-800">24/7 Emergency Line</span>
                  </div>
                  <p className="text-xs text-orange-700">
                    Call +1 (555) 123-4567 and press 9 for emergency support
                  </p>
                  <Button variant="outline" className="w-full border-orange-300 text-orange-800 hover:bg-orange-100">
                    Emergency Contact
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 