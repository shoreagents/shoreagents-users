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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function NavProjects({
  projects,
}: {
  projects: {
    name: string
    url: string
    icon: LucideIcon
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link href={item.url}>
                  <item.icon />
                        {state === "expanded" && <span>{item.name}</span>}
                </Link>
              </SidebarMenuButton>
                  </TooltipTrigger>
                  {state === "collapsed" && (
                    <TooltipContent side="right">
                      <p>{item.name}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
