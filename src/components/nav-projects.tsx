"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  type LucideIcon,
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

  return (
    <SidebarGroup className={state === "collapsed" ? "flex justify-center" : ""}>
      {state === "expanded" && <SidebarGroupLabel>Quick Actions</SidebarGroupLabel>}
      <SidebarMenu className={state === "collapsed" ? "flex flex-col items-center" : ""}>
        {projects.map((item) => {
          const isActive = pathname === item.url
          return (
            <SidebarMenuItem key={item.name}>
              {state === "collapsed" ? (
                // When collapsed, show dropdown menu on hover instead of tooltip
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton 
                      isActive={isActive}
                      className={isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : ""}
                    >
                      <item.icon />
                      <span className="sr-only">{item.name}</span>
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="w-40">
                    <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground border-b">
                      Quick Action
                    </div>
                    <DropdownMenuItem asChild>
                      {item.onClick ? (
                        <button
                          onClick={item.onClick}
                          className="flex items-center justify-between w-full px-2 py-1.5 text-sm cursor-pointer"
                        >
                          <span>{item.name}</span>
                        </button>
                      ) : (
                        <Link 
                          href={item.url}
                          className="flex items-center justify-between w-full"
                        >
                          <span>{item.name}</span>
                        </Link>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                // When expanded, show normal button with text
                item.onClick ? (
                  <SidebarMenuButton 
                    onClick={item.onClick}
                    isActive={isActive}
                    className={`cursor-pointer ${isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : ""}`}
                  >
                    <item.icon />
                    <span>{item.name}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive}
                    className={isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : ""}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                )
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
