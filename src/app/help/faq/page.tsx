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
import { 
  ArrowLeft, 
  HelpCircle,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpFaqSkeleton } from "@/components/skeleton-loaders"

const faqData = [
  {
    category: "General Support",
    items: [
      {
        question: "How do I submit a support ticket?",
        answer: "You can submit a support ticket by navigating to 'Support Tickets' → 'New Ticket' in the sidebar. Fill out the form with your details and submit. You'll receive a unique ticket ID for tracking."
      },
      {
        question: "How long does it take to get a response?",
        answer: "We typically respond to support tickets within 24-48 hours during business days. Urgent issues are prioritized and may receive faster responses."
      },
      {
        question: "Can I track the status of my ticket?",
        answer: "Yes! You can view all your tickets and their current status by going to 'Support Tickets' → 'My Tickets' in the sidebar. Each ticket shows its current status (Pending, In Progress, or Resolved)."
      }
    ]
  },
  {
    category: "Technical Issues",
    items: [
      {
        question: "What should I do if my computer/equipment isn't working?",
        answer: "Submit a support ticket under the 'Computer/Equipment' category. Include specific details about the issue, any error messages, and when the problem started. Our IT team will assist you."
      },
      {
        question: "How do I report station-related problems?",
        answer: "For station issues, create a ticket under the 'Station' category. Describe the problem, your station number, and any relevant details. We'll coordinate with the appropriate team."
      },
      {
        question: "What if I'm having connectivity issues?",
        answer: "Connectivity issues should be reported under 'Computer/Equipment' category. Include details about your internet connection, any error messages, and when the problem began."
      }
    ]
  },
  {
    category: "Work Environment",
    items: [
      {
        question: "How do I report workplace environment concerns?",
        answer: "Use the 'Surroundings' category when submitting a ticket. Describe the specific concern, location, and any safety implications. We take workplace environment issues seriously."
      },
      {
        question: "What if I need to discuss my schedule?",
        answer: "Schedule-related questions should be submitted under the 'Schedule' category. Include your current schedule, requested changes, and reasons for the request."
      },
      {
        question: "How do I request compensation-related support?",
        answer: "For compensation questions, use the 'Compensation' category. Be specific about your inquiry and include any relevant documentation or context."
      }
    ]
  },
  {
    category: "Account & Access",
    items: [
             {
         question: "How do I chat with my account manager?",
         answer: "Use the 'Check-in (chat with account manager)' category when submitting a ticket. This will connect you directly with your assigned account manager for personalized support."
       },
      {
        question: "What if I can't access my account?",
        answer: "Submit a ticket under 'Computer/Equipment' category and clearly state that it's an account access issue. Include any error messages you're seeing."
      },
      {
        question: "How do I update my contact information?",
        answer: "You can update your contact information in your profile settings, or submit a ticket under 'Settings' category if you need assistance with account changes."
      }
    ]
  }
]

export default function FAQPage() {
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
          <HelpFaqSkeleton />
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
              <h1 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h1>
              <p className="text-muted-foreground">Find answers to common questions about support and services</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {faqData.map((category, categoryIndex) => (
                <Card key={categoryIndex}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      {category.category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {category.items.map((item, itemIndex) => (
                        <AccordionItem key={itemIndex} value={`item-${categoryIndex}-${itemIndex}`}>
                          <AccordionTrigger className="text-left">
                            {item.question}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground">
                            {item.answer}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>
                    Get help faster with these quick options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col gap-1">
                  <Link href="/forms/new">
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="mr-2 h-4 w-4" />
                      Submit New Ticket
                    </Button>
                  </Link>
                  <Link href="/forms/my-tickets">
                    <Button variant="outline" className="w-full justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      View My Tickets
                    </Button>
                  </Link>
                  <Link href="/help/contact">
                    <Button variant="outline" className="w-full justify-start">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Contact Support
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Need More Help?</CardTitle>
                  <CardDescription>
                    Can&apos;t find what you&apos;re looking for?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">24/7 Support Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Response within 24-48 hours</span>
                  </div>
                  <Link href="/help/contact">
                    <Button className="w-full">
                      Contact Support Team
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