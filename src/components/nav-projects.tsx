"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  type LucideIcon,
  ChevronRight,
} from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url: string
    icon: LucideIcon
    onClick?: () => void
  }[]
}) {
  const { isMobile, state } = useSidebar()
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    setIsHovered(true)
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
  }

  return (
    <SidebarGroup className={state === "collapsed" ? "flex justify-center" : ""}>
      <SidebarMenu className={state === "collapsed" ? "flex flex-col items-center" : ""}>
        <SidebarMenuItem>
          <div 
            ref={containerRef}
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="w-full justify-between flex items-center px-2 py-1.5 text-sm hover:bg-accent rounded-md cursor-pointer">
              {state === "collapsed" ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <span className="flex items-center gap-2">
                    <span>Quick Actions</span>
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </div>
            {/* Arrow pointer connecting button to dropdown */}
            <div 
              className={`absolute left-full bottom-0 -translate-y-1/2 transition-opacity duration-150 z-50 ${
                isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div 
                className="w-0 h-0 border-r-8 border-r-gray-900 dark:border-r-white border-t-8 border-t-transparent border-b-8 border-b-transparent"
              ></div>
            </div>
            
            <div 
              className={`absolute left-full -top-8 -translate-y-1/2 ml-2 w-48 bg-popover border rounded-md shadow-md transition-opacity duration-150 z-40 ${
                isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b">
                Quick Actions
              </div>
              {projects.map((item) => {
                const isActive = pathname === item.url
                return (
                  <div key={item.name} className="px-2 py-1.5 text-sm hover:bg-accent cursor-pointer">
                    {item.onClick ? (
                      <button
                        onClick={item.onClick}
                        className={`flex items-center gap-2 w-full text-left ${
                          isActive ? "text-primary" : ""
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </button>
                    ) : (
                      <Link 
                        href={item.url}
                        className={`flex items-center gap-2 w-full ${
                          isActive ? "text-primary" : ""
                        }`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
