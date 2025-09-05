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
  BarChart3,
  Activity,
  Smile,
  Heart,
  CheckSquare,
  Clock,
} from "lucide-react"
import { useActivityStatus } from "@/hooks/use-activity-status"
import { useMeeting } from "@/contexts/meeting-context"
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
  const [notStartedTaskCount, setNotStartedTaskCount] = React.useState(0)

  // Activity status indicator component
  const ActivityStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isLoading 
            ? 'bg-gray-400 animate-pulse' 
            : isShiftEnded
              ? 'bg-red-500'
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
              : isInMeeting 
                ? 'In Meeting' 
                : isActivityActive 
                  ? 'Active' 
                  : 'Inactive'
        }
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

  // Task notification indicator component
  const TaskNotificationIndicator = () => (
    <div className="flex items-center">
      <div 
        className="w-2 h-2 rounded-full bg-red-500"
        title={`${notStartedTaskCount} tasks not started`}
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
        plan: "Agent",
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
            url: "/forms/new",
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
            title: "Task Activity",
            url: "/productivity/task-activity",
          },
        ],
      },
      {
        title: "Set Your Status",
        icon: Smile,
        isActive: pathname.startsWith("/status"),
        statusIndicator: isInMeeting ? <MeetingStatusIndicator /> : null,
        items: [
          {
            title: "Breaks",
            url: "/status/breaks",
          },
          {
            title: "Meetings",
            url: "/status/meetings",
            statusIndicator: <MeetingStatusIndicator />,
          },
        ],
      },
      {
        title: "Health",
        icon: Heart,
        isActive: pathname.startsWith("/health"),
        items: [
          {
            title: "Health Staff",
            url: "/health",
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
            title: "Contact Support",
            url: "/help/contact",
          },
          {
            title: "Report an Issue",
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
            title: "Change Password",
            url: "/settings/password",
          },
          {
            title: "Team Status",
            url: "/settings/connected-users",
          },
        ],
      },

    ],
    quickActions: [
      {
        name: "New Ticket",
        url: "/forms/new",
        icon: Plus,
      },
      {
        name: "Breaks",
        url: "/status/breaks",
        icon: Clock,
      },
      {
        name: "Meetings",
        url: "/status/meetings",
        icon: MessageSquare,
      },
    ],
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-2">
            <NavMain items={data.navMain} />
            
            {/* Leaderboard Section - Only show when not collapsed */}
            {state === "expanded" && (
              <div className="px-1 py-2">
                <Leaderboard />
              </div>
            )}
          </div>
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 pb-2">
          <NavProjects projects={data.quickActions} />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
})


