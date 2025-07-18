"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { HeaderUser } from "@/components/header-user"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getCurrentUser } from "@/lib/ticket-utils"

interface BreadcrumbItem {
  title: string
  href?: string
  isCurrent?: boolean
}

interface AppHeaderProps {
  breadcrumbs?: BreadcrumbItem[]
  showUser?: boolean
}

export function AppHeader({ breadcrumbs, showUser = true }: AppHeaderProps) {
  const pathname = usePathname()
  const [user, setUser] = useState({
    name: "Agent User",
    email: "agent@shoreagents.com",
    avatar: "/avatars/agent.jpg",
  })

  useEffect(() => {
    // Get user data from localStorage
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser({
        name: currentUser.name || "Agent User",
        email: currentUser.email || "agent@shoreagents.com",
        avatar: "/avatars/agent.jpg",
      })
    }
  }, [])

  // Generate breadcrumbs based on pathname if not provided
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (breadcrumbs) return breadcrumbs

    const pathSegments = pathname.split('/').filter(Boolean)
    const generatedBreadcrumbs: BreadcrumbItem[] = []

    // Add Dashboard as root for dashboard pages
    if (pathSegments[0] === 'dashboard') {
      generatedBreadcrumbs.push({
        title: 'Dashboard'
      })

      // Add sub-pages
      if (pathSegments[1] === 'activity') {
        generatedBreadcrumbs.push({
          title: 'Activity',
          href: '/dashboard/activity'
        })
      } else if (pathSegments[1] === 'analytics') {
        generatedBreadcrumbs.push({
          title: 'Analytics',
          href: '/dashboard/analytics'
        })
      } else if (pathSegments.length === 1) {
        // Dashboard home page - make it clickable
        generatedBreadcrumbs[0].href = '/dashboard'
      }
    } else if (pathSegments[0] === 'forms') {
      generatedBreadcrumbs.push({
        title: 'Support Tickets'
      })

      if (pathSegments[1] === 'new') {
        generatedBreadcrumbs.push({
          title: 'New Ticket',
          href: '/forms/new'
        })
      } else if (pathSegments[1] === 'my-tickets') {
        generatedBreadcrumbs.push({
          title: 'My Tickets',
          href: '/forms/my-tickets'
        })
      } else if (pathSegments.length === 1) {
        // Forms home page - make it clickable
        generatedBreadcrumbs[0].href = '/forms'
      }
    } else if (pathSegments[0] === 'help') {
      generatedBreadcrumbs.push({
        title: 'Help & Support'
      })

      if (pathSegments[1] === 'faq') {
        generatedBreadcrumbs.push({
          title: 'FAQ',
          href: '/help/faq'
        })
      } else if (pathSegments[1] === 'contact') {
        generatedBreadcrumbs.push({
          title: 'Contact Support',
          href: '/help/contact'
        })
      } else if (pathSegments[1] === 'docs') {
        generatedBreadcrumbs.push({
          title: 'Documentation',
          href: '/help/docs'
        })
      } else if (pathSegments.length === 1) {
        // Help home page - make it clickable
        generatedBreadcrumbs[0].href = '/help'
      }
    } else if (pathSegments[0] === 'productivity') {
      generatedBreadcrumbs.push({
        title: 'Productivity'
      })

      if (pathSegments[1] === 'tasks') {
        generatedBreadcrumbs.push({
          title: 'Task Tracker',
          href: '/productivity/tasks'
        })
      } else if (pathSegments.length === 1) {
        // Productivity home page - make it clickable
        generatedBreadcrumbs[0].href = '/productivity'
      }
    } else if (pathSegments[0] === 'breaks') {
      generatedBreadcrumbs.push({
        title: 'Breaks'
      })
      generatedBreadcrumbs.push({
        title: 'Break Management',
        href: '/breaks'
      })
    } else if (pathSegments[0] === 'health') {
      generatedBreadcrumbs.push({
        title: 'Health'
      })
      generatedBreadcrumbs.push({
        title: 'Health Staff',
        href: '/health'
      })
    } else if (pathSegments[0] === 'settings') {
      generatedBreadcrumbs.push({
        title: 'Settings'
      })

      if (pathSegments[1] === 'profile') {
        generatedBreadcrumbs.push({
          title: 'Profile',
          href: '/settings/profile'
        })
      } else if (pathSegments.length === 1) {
        // Settings home page - make it clickable
        generatedBreadcrumbs[0].href = '/settings'
      }
    }

    return generatedBreadcrumbs
  }

  const currentBreadcrumbs = generateBreadcrumbs()

  return (
    <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80 border-b border-border/40 shadow-sm">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {currentBreadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center">
                <BreadcrumbItem>
                  {item.isCurrent ? (
                    <BreadcrumbPage>{item.title}</BreadcrumbPage>
                  ) : item.href ? (
                    <BreadcrumbLink href={item.href}>{item.title}</BreadcrumbLink>
                  ) : (
                    <span>{item.title}</span>
                  )}
                </BreadcrumbItem>
                {index < currentBreadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {showUser && (
        <div className="ml-auto flex items-center gap-2 px-4">
          <HeaderUser user={user} />
        </div>
      )}
    </header>
  )
} 