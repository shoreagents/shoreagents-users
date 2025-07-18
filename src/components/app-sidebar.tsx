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

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { state } = useSidebar()

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
        <NavMain items={data.navMain} />
        
        {/* Leaderboard Section - Only show when not collapsed */}
        {state === "expanded" && (
          <div className="px-3 py-2">
            <Leaderboard />
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavProjects projects={data.quickActions} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
