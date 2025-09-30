"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  FileText,
  Plus,
  Settings2,
  Home,
  HelpCircle,
  MessageSquare,
  Smile,
  CheckSquare,
  Clock,
  Toilet,
} from "lucide-react"
import { NewTicketDialog } from "@/components/new-ticket-dialog"
import { useActivityStatus } from "@/hooks/use-activity-status"
import { useMeeting } from "@/contexts/meeting-context"
import { useEventsContext } from "@/contexts/events-context"
import { useHealth } from "@/contexts/health-context"
import { useRestroom } from "@/contexts/restroom-context"
// import { getNotStartedTaskCount } from "@/lib/task-utils"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { TeamSwitcher } from "@/components/team-switcher"
import { Leaderboard } from "@/components/leaderboard"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"

export const AppSidebar = React.memo(function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { isActive: isActivityActive, isLoading, isShiftEnded } = useActivityStatus()
  const { isInMeeting } = useMeeting()
  const { isInEvent, currentEvent } = useEventsContext()
  const { isGoingToClinic, isInClinic } = useHealth()
  const { isInRestroom, restroomCount } = useRestroom()
  const [notStartedTaskCount, setNotStartedTaskCount] = React.useState(0)
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = React.useState(false)

  // Activity status indicator component
  const ActivityStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isLoading 
            ? 'bg-gray-400 animate-pulse' 
            : isShiftEnded
              ? 'bg-red-500'
              : isInRestroom
                ? 'bg-red-500 animate-pulse'
                : isInEvent
                  ? 'bg-purple-500 animate-pulse'
                  : isInMeeting 
                    ? 'bg-yellow-500 animate-pulse' 
                    : isActivityActive 
                      ? 'bg-green-500' 
                      : 'bg-red-500'
        }`}
        title={
          isLoading 
            ? 'Loading...' 
            : isShiftEnded
              ? 'Shift Ended'
              : isInRestroom
                ? `In Restroom (${restroomCount} visits today)`
                : isInEvent
                  ? `In Event: ${currentEvent?.title || 'Unknown Event'}`
                  : isInMeeting 
                    ? 'In Meeting' 
                    : isActivityActive 
                      ? 'Active' 
                      : 'Inactive'
        }
      />
    </div>
  )

  // Event status indicator component
  const EventStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isInEvent 
            ? 'bg-purple-500 animate-pulse' 
            : 'bg-gray-300'
        }`}
        title={isInEvent ? `In Event: ${currentEvent?.title || 'Unknown Event'}` : 'No Active Event'}
      />
    </div>
  )

  // Meeting status indicator component
  const MeetingStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isInMeeting 
            ? 'bg-yellow-500 animate-pulse' 
            : 'bg-gray-300'
        }`}
        title={isInMeeting ? 'In Meeting' : 'No Active Meeting'}
      />
    </div>
  )

  // Going to clinic status indicator component
  const GoingToClinicStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isGoingToClinic 
            ? 'bg-orange-500 animate-pulse' 
            : 'bg-gray-300'
        }`}
        title={isGoingToClinic ? 'Going to Clinic' : 'Not Going to Clinic'}
      />
    </div>
  )

  // In clinic status indicator component
  const InClinicStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isInClinic 
            ? 'bg-blue-500 animate-pulse' 
            : 'bg-gray-300'
        }`}
        title={isInClinic ? 'In Clinic' : 'Not In Clinic'}
      />
    </div>
  )

  // Restroom status indicator component
  const RestroomStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isInRestroom 
            ? 'bg-red-500 animate-pulse' 
            : 'bg-gray-300'
        }`}
        title={isInRestroom ? `In Restroom (${restroomCount} visits today)` : `Not In Restroom (${restroomCount} visits today)`}
      />
    </div>
  )

  // Update task count - OPTIMIZED to prevent continuous API calls
  React.useEffect(() => {
    const updateTaskCount = async () => {
      // Only update task count if we're on task-related pages
      if (pathname.startsWith("/productivity") || pathname.startsWith("/dashboard")) {
        try {
          // TODO: Replace with new task system if needed
          // const count = await getNotStartedTaskCount()
          setNotStartedTaskCount(0)
        } catch (error) {
          console.error('Error getting task count:', error)
          setNotStartedTaskCount(0)
        }
      }
    }

    updateTaskCount()
    
    // Listen for task updates instead of polling
    const handleTaskUpdate = () => {
      if (pathname.startsWith("/productivity") || pathname.startsWith("/dashboard")) {
        updateTaskCount()
      }
    }

    // Listen for custom events when tasks are updated
    window.addEventListener('tasks-updated', handleTaskUpdate)
    
    return () => {
      window.removeEventListener('tasks-updated', handleTaskUpdate)
    }
  }, [pathname]) // Depend on pathname to update when navigating to task pages

  // ShoreAgents data with dynamic active state
  const data = {
    teams: [
      {
        name: "ShoreAgents",
        logo: FileText,
        plan: "Agent Dashboard",
      },
    ],
    navMain: [
      {
        title: "Dashboard",
        icon: Home,
        isActive: pathname.startsWith("/dashboard"),
        statusIndicator: <ActivityStatusIndicator />,
        items: [
          {
            title: "Overview",
            url: "/dashboard",
          },
          {
            title: "Analytics",
            url: "/dashboard/analytics",
          },
          {
            title: "Activity",
            url: "/dashboard/activity",
            statusIndicator: <ActivityStatusIndicator />,
          },
        ],
      },
      {
        title: "Support Tickets",
        icon: FileText,
        isActive: pathname.startsWith("/forms"),
        items: [
          {
            title: "New Ticket",
            url: "#",
            onClick: () => setIsNewTicketDialogOpen(true),
          },
          {
            title: "My Tickets",
            url: "/forms/my-tickets",
          },
        ],
      },
      {
        title: "Productivity",
        icon: CheckSquare,
        isActive: pathname.startsWith("/productivity"),
        items: [
          {
            title: "Tasks",
            url: "/productivity/task-activity",
          },
        ],
      },
      {
        title: "Set Your Status",
        icon: Smile,
        isActive: pathname.startsWith("/status"),
        statusIndicator: isInRestroom ? <RestroomStatusIndicator /> : isInClinic ? <InClinicStatusIndicator /> : isGoingToClinic ? <GoingToClinicStatusIndicator /> : isInEvent ? <EventStatusIndicator /> : isInMeeting ? <MeetingStatusIndicator /> : null,
        items: [
          {
            title: "Breaks",
            url: "/status/breaks",
          },
          {
            title: "Meetings",
            url: "/status/meetings",
            statusIndicator: isInMeeting ? <MeetingStatusIndicator /> : null,
          },
          {
            title: "Events & Activities",
            url: "/status/events",
            statusIndicator: isInEvent ? <EventStatusIndicator /> : null,
          },
          {
            title: "Restroom",
            url: "/status/restroom",
            statusIndicator: isInRestroom ? <RestroomStatusIndicator /> : null,
          },
          {
            title: "Clinic",
            url: "/status/health",
            statusIndicator: isInClinic ? <InClinicStatusIndicator /> : isGoingToClinic ? <GoingToClinicStatusIndicator /> : null,
          },
        ],
      },
      {
        title: "Help & Support",
        icon: HelpCircle,
        isActive: pathname.startsWith("/help"),
        items: [
          {
            title: "FAQ",
            url: "/help/faq",
          },
          {
            title: "Contact",
            url: "/help/contact",
          },
          {
            title: "Report Issue",
            url: "/help/report",
          },
        ],
      },
      {
        title: "Settings",
        icon: Settings2,
        isActive: pathname.startsWith("/settings"),
        items: [
          {
            title: "Profile",
            url: "/settings/profile",
          },
          {
            title: "Password",
            url: "/settings/password",
          },
          {
            title: "Team",
            url: "/settings/connected-users",
          },
        ],
      },

    ],
    quickActions: [
      {
        name: "New Ticket",
        url: "#",
        icon: Plus,
        onClick: () => setIsNewTicketDialogOpen(true),
      },
      {
        name: "Breaks",
        url: "/status/breaks",
        icon: Clock,
      },
      {
        name: "Restroom",
        url: "/status/restroom",
        icon: Toilet,
      },
    ],
  }

  return (
    <>
      <Sidebar collapsible="icon" {...props} data-sidebar>
        <SidebarHeader>
          <TeamSwitcher teams={data.teams} />
        </SidebarHeader>
        <SidebarContent>
          <ScrollArea className="flex-1 px-2">
            <div className="space-y-2">
              <NavMain items={data.navMain} />
            </div>
          </ScrollArea>
        </SidebarContent>
        <SidebarFooter className="border-t border-gray-500">
          {/* Leaderboard Section - Only show when not collapsed */}
          {state === "expanded" && (
            <div className="px-1 ">
              <Leaderboard />
            </div>
          )}
          <div className="px-2" data-quick-actions>
            <NavProjects projects={data.quickActions} />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      
      {/* New Ticket Dialog */}
      <NewTicketDialog 
        open={isNewTicketDialogOpen} 
        onOpenChange={setIsNewTicketDialogOpen} 
      />
    </>
  )
})


