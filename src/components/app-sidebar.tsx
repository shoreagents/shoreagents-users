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
  Coffee,
  Heart,
  CheckSquare,
} from "lucide-react"
import { useActivityStatus } from "@/hooks/use-activity-status"

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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { isActive: isActivityActive, isLoading } = useActivityStatus()

  // Activity status indicator component
  const ActivityStatusIndicator = () => (
    <div className="flex items-center">
      <div 
        className={`w-2 h-2 rounded-full ${
          isLoading 
            ? 'bg-gray-400 animate-pulse' 
            : isActivityActive 
              ? 'bg-green-500' 
              : 'bg-red-500'
        }`}
        title={isLoading ? 'Loading...' : isActivityActive ? 'Active' : 'Inactive'}
      />
    </div>
  )

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
            title: "Task Tracker",
            url: "/productivity/tasks",
          },
        ],
      },
      {
        title: "Breaks",
        icon: Coffee,
        isActive: pathname.startsWith("/breaks"),
        items: [
          {
            title: "Break Management",
            url: "/breaks",
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
            title: "Documentation",
            url: "/help/docs",
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
        ],
      },
    ],
    quickActions: [
      {
        name: "Create New Ticket",
        url: "/forms/new",
        icon: Plus,
      },
      {
        name: "View Analytics",
        url: "/dashboard/analytics",
        icon: BarChart3,
      },
      {
        name: "Activity Dashboard",
        url: "/dashboard/activity",
        icon: Activity,
      },
      {
        name: "Health Staff",
        url: "/health",
        icon: Heart,
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
}
