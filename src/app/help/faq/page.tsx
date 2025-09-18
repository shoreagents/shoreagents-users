"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
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
    category: "Meeting Management",
    items: [
      {
        question: "How do I start a meeting?",
        answer: "Click the 'Start Meeting' button in the meeting indicator or go to the Status → Meetings page. The system will automatically track your meeting time and notify relevant parties."
      },
      {
        question: "Can I end a meeting early?",
        answer: "Yes, you can end a meeting at any time by clicking the 'End Meeting' button. The system will record the actual meeting duration and update your status accordingly."
      },
      {
        question: "What happens if I forget to end a meeting?",
        answer: "The system will show a persistent meeting indicator. You can end it from the meeting indicator on your screen or from the Status → Meetings page."
      },
      {
        question: "How do I view my meeting history?",
        answer: "Go to Status → Meetings to view your complete meeting history, including duration, timestamps, and any notes associated with each meeting."
      }
    ]
  },
  {
    category: "Events & Activities",
    items: [
      {
        question: "How do I join an event or activity?",
        answer: "When an event is active, you'll see a notification popup. Click 'Join Event' to participate. You can also view upcoming events in the Status → Events section."
      },
      {
        question: "What if I'm in a meeting when an event starts?",
        answer: "You cannot join an event while in a meeting. When you try to join, the system will show an alert asking if you want to end your current meeting and join the event. You must end your meeting first before joining any event or activity."
      },
      {
        question: "Can I leave an event early?",
        answer: "Yes, you can leave an event at any time by clicking the 'Leave Event' button in the event indicator or from the Status → Events page. This will update your status and notify the event organizers."
      },
      {
        question: "How do I know what type of event is happening?",
        answer: "The event indicator shows the event type (either 'Event' or 'Activity') with the event/activity title displayed clearly."
      }
    ]
  },
  {
    category: "Restroom Tracking",
    items: [
      {
        question: "How do I take a restroom break?",
        answer: "Click the restroom button (toilet icon) on the right side of your screen or from the Status → Restroom page. The system will track your break time and show a red indicator while you're away."
      },
      {
        question: "What if the restroom button is hidden?",
        answer: "If you're in a meeting, event, or other restricted state, the restroom button will be hidden. Complete your current activity first, then the restroom option will become available."
      },
      {
        question: "How do I know I'm still in restroom mode?",
        answer: "When the restroom indicator is hidden but you're still in restroom mode, you'll see a bouncing chevron with a red dot indicator or In meeting indicator from activity timer to remind you to finish your restroom break."
      },
      {
        question: "Can I see my restroom break history?",
        answer: "Yes, the system tracks your daily and total restroom visits. This information is displayed in the restroom button tooltip and can be viewed from the Status → Restroom page."
      }
    ]
  },
  {
    category: "Clinic & Health",
    items: [
      {
        question: "How do I go to the clinic?",
        answer: "First, submit a health check request through the health section. Once the company nurse approves your request, you'll receive a notification. Then you can click 'Go to Clinic' to update your status."
      },
      {
        question: "What's the difference between 'Going to Clinic' and 'In Clinic'?",
        answer: "'Going to Clinic' indicates you're on your way, while 'In Clinic' means you've arrived and are currently receiving medical attention. Update your status accordingly."
      },
      {
        question: "How do I submit a health check request?",
        answer: "Go to the health section and click 'Request Health Check'. Fill out the required information about your health concern. The request will be sent to the company nurse for review and approval."
      },
      {
        question: "How long can I stay in clinic mode?",
        answer: "Clinic visits are tracked for medical purposes. The system will maintain your clinic status until you manually update it or return to your workstation."
      },
      {
        question: "What do I do after the nurse completes my health check?",
        answer: "Once the company nurse completes your health check, you need to click 'Done - Back to Station' to resume your working duties. This will update your status and return you to active work mode."
      }
    ]
  },
  {
    category: "Break Management",
    items: [
      {
        question: "How do I take a break?",
        answer: "Use the break management system to start your scheduled break. The system will automatically compute valid break time based on your shift schedule and enter kiosk mode for fullscreen display."
      },
      {
        question: "What happens to my screen during a break?",
        answer: "Your screen will enter kiosk mode (fullscreen) showing the break timer. If you have dual monitors, one monitor will display the fullscreen break timer while the second monitor will show a black screen."
      },
      {
        question: "How is my break time calculated?",
        answer: "Each break's valid time is automatically computed based on your shift time schedule. The system ensures you get the appropriate break duration according to your work hours and company policies."
      },
      {
        question: "What is emergency pause and how do I use it?",
        answer: "Each break includes one emergency pause that you can use if something urgent comes up. This pause is available only once per break and should be used for genuine emergencies only."
      },
      {
        question: "Can I end my break early?",
        answer: "Yes, you can manually end your break early by clicking 'End Break' to return to station ahead of schedule. If you choose to return early, your normal work activity will resume immediately."
      }
    ]
  },
  {
    category: "Team Status & Monitoring",
    items: [
      {
        question: "How can I see my team's status?",
        answer: "Go to the Settings → Team Status to view real-time team status, including who's in meetings, on breaks, at events, or only for collaboration."
      },
      {
        question: "What information is visible to my team?",
        answer: "Your current status (meeting, restroom, going to clinic, in clinic, break, event) is visible to your team members."
      },
      {
        question: "How do I update my status?",
        answer: "Use the various status indicators (meeting, restroom, going to clinic, in clinic, break, event)."
      }
    ]
  },
  {
    category: "Profile & Account Management",
    items: [
      {
        question: "How do I change my password?",
        answer: "Go to Settings → Change Password. You'll need to enter your current password and create a new secure password following the system requirements."
      },
      {
        question: "How do I update my profile information?",
        answer: "You cannot change your profile information directly. You need to submit a request to the admin through the support ticket system under the 'Settings' category to request changes to your personal information, contact details, or preferences."
      },
      {
        question: "What profile tasks are available?",
        answer: "Profile tasks include changing passwords, managing notifications, setting preferences, and configuring your dashboard layout. For personal information changes, you need to submit a support ticket to the admin."
      }
    ]
  },
  {
    category: "Activity Tracking & Reports",
    items: [
      {
        question: "How do I view my activity page?",
        answer: "Go to the Activity section to view detailed reports of your work activities, including meeting times, break durations, productivity metrics, and task completion."
      },
      {
        question: "What information is tracked in my activity?",
        answer: "The system tracks meetings, breaks, restroom visits, events, clinic visits, task completion, and overall productivity metrics for performance analysis."
      },
      {
        question: "Can I export my activity data?",
        answer: "Yes, you can export your activity data in various formats (PDF, Excel) for personal records or performance reviews. Look for the export options in the Activity page."
      },
      {
        question: "How far back can I view my activity history?",
        answer: "Activity history is typically available for the past 30-90 days, depending on your role and system configuration. Contact support if you need access to older data."
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