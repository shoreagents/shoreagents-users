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
  FileText, 
  BookOpen,
  Download,
  ExternalLink,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  Settings,
  Monitor
} from "lucide-react"
import Link from "next/link"
import { HelpDocsSkeleton } from "@/components/skeleton-loaders"

const documentationCategories = [
  {
    title: "Getting Started",
    description: "Essential guides for new users",
    icon: BookOpen,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    items: [
      {
        title: "Welcome Guide",
        description: "Complete overview of the ShoreAgents platform",
        type: "PDF",
        size: "2.3 MB",
        href: "#"
      },
      {
        title: "Quick Start Guide",
        description: "Get up and running in 10 minutes",
        type: "PDF",
        size: "1.1 MB",
        href: "#"
      },
      {
        title: "System Requirements",
        description: "Hardware and software requirements",
        type: "PDF",
        size: "0.8 MB",
        href: "#"
      }
    ]
  },
  {
    title: "User Guides",
    description: "Detailed instructions for common tasks",
    icon: Users,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    items: [
      {
        title: "Support Ticket Guide",
        description: "How to create and manage support tickets",
        type: "PDF",
        size: "3.2 MB",
        href: "#"
      },
      {
        title: "Dashboard Overview",
        description: "Understanding your dashboard and metrics",
        type: "PDF",
        size: "2.1 MB",
        href: "#"
      },
      {
        title: "Account Management",
        description: "Managing your profile and settings",
        type: "PDF",
        size: "1.5 MB",
        href: "#"
      }
    ]
  },
  {
    title: "Technical Documentation",
    description: "Technical specifications and API references",
    icon: Settings,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    items: [
      {
        title: "API Reference",
        description: "Complete API documentation and examples",
        type: "PDF",
        size: "5.7 MB",
        href: "#"
      },
      {
        title: "Integration Guide",
        description: "How to integrate with third-party systems",
        type: "PDF",
        size: "4.2 MB",
        href: "#"
      },
      {
        title: "Troubleshooting Guide",
        description: "Common issues and their solutions",
        type: "PDF",
        size: "2.8 MB",
        href: "#"
      }
    ]
  },
  {
    title: "Equipment & Station Guides",
    description: "Hardware and workstation documentation",
    icon: Monitor,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    items: [
      {
        title: "Equipment Setup Guide",
        description: "Setting up your workstation and equipment",
        type: "PDF",
        size: "3.9 MB",
        href: "#"
      },
      {
        title: "Station Configuration",
        description: "Configuring your work station",
        type: "PDF",
        size: "2.4 MB",
        href: "#"
      },
      {
        title: "Maintenance Procedures",
        description: "Regular maintenance and care instructions",
        type: "PDF",
        size: "1.8 MB",
        href: "#"
      }
    ]
  }
]

const quickLinks = [
  {
    title: "Video Tutorials",
    description: "Step-by-step video guides",
    icon: ExternalLink,
    href: "#",
    badge: "New"
  },
  {
    title: "Knowledge Base",
    description: "Searchable articles and guides",
    icon: BookOpen,
    href: "#",
    badge: "Popular"
  },
  {
    title: "Training Materials",
    description: "Comprehensive training resources",
    icon: Users,
    href: "#",
    badge: "Updated"
  }
]

export default function DocumentationPage() {
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
          <HelpDocsSkeleton />
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
              <h1 className="text-3xl font-bold text-foreground">Documentation</h1>
              <p className="text-muted-foreground">Comprehensive guides and resources for ShoreAgents platform</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Documentation Categories */}
              {documentationCategories.map((category, categoryIndex) => (
                <Card key={categoryIndex} className={`${category.borderColor} ${category.bgColor}`}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <category.icon className={`h-5 w-5 ${category.color}`} />
                      {category.title}
                    </CardTitle>
                    <CardDescription>
                      {category.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {category.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.title}</h4>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {item.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{item.size}</span>
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Links */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Links</CardTitle>
                  <CardDescription>
                    Popular documentation resources
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {quickLinks.map((link, index) => (
                    <Link key={index} href={link.href}>
                      <div className="flex items-center justify-between p-3 hover:bg-muted rounded-lg transition-colors">
                        <div className="flex items-center gap-3">
                          <link.icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{link.title}</p>
                            <p className="text-xs text-muted-foreground">{link.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {link.badge}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>

              {/* Documentation Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Documentation Stats</CardTitle>
                  <CardDescription>
                    Latest updates and metrics
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">Total Guides</span>
                    </div>
                    <span className="font-medium">24</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Last Updated</span>
                    </div>
                    <span className="text-sm text-muted-foreground">2 days ago</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">Completeness</span>
                    </div>
                    <span className="font-medium">98%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Help & Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                  <CardDescription>
                    Can&apos;t find what you&apos;re looking for?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col gap-1">
                  <Link href="/help/faq">
                    <Button variant="outline" className="w-full justify-start">
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Browse FAQ
                    </Button>
                  </Link>
                  <Link href="/help/contact">
                    <Button variant="outline" className="w-full justify-start">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Contact Support
                    </Button>
                  </Link>
                  <Link href="/forms/new">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Submit Ticket
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 