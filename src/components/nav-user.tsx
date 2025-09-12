"use client"

import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useActivity } from "@/contexts/activity-context"
import { useLogout } from "@/contexts/logout-context"
import { getCurrentUser } from "@/lib/ticket-utils"
import { hasOngoingMeeting, endMeeting } from "@/lib/meeting-utils"
import { forceLogout } from "@/lib/auth-utils"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const { setUserLoggedOut } = useActivity()
  const { startLogout } = useLogout()

  const getInitials = (fullName?: string, email?: string) => {
    const name = (fullName || '').trim()
    if (name.length > 0) {
      const parts = name.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      }
      return name.slice(0, 2).toUpperCase()
    }
    const mail = (email || '').trim()
    if (mail.includes('@')) {
      const [local, domain] = mail.split('@')
      const a = local?.[0] || ''
      const b = domain?.[0] || ''
      const initials = `${a}${b}`
      return initials ? initials.toUpperCase() : 'SA'
    }
    return 'SA'
  }

  const handleLogout = async () => {
    // Start logout loading state
    startLogout()
    
    // Get current user before clearing auth
    const currentUser = getCurrentUser()
    
    // Check if user has an ongoing meeting and end it
    try {
      const hasOngoing = await hasOngoingMeeting()
      if (hasOngoing) {
        
        // Get meetings to find the active one
        const { getMeetings } = await import('@/lib/meeting-utils')
        const meetings = await getMeetings()
        const activeMeeting = meetings.find(m => m.status === 'in-progress')
        
        if (activeMeeting) {
          await endMeeting(activeMeeting.id)
        }
      }
    } catch (error) {
      console.error('Error ending meeting during logout:', error)
      // Continue with logout even if meeting cleanup fails
    }
    
    // Use the new logout utility function
    forceLogout()
    
    // Stop activity tracking (this will be picked up by the auth monitor)
    setUserLoggedOut()
    
    // Redirect to login
    router.push("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">{getInitials(user.name, user.email)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="rounded-lg">{getInitials(user.name, user.email)}</AvatarFallback>
                  </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <BadgeCheck />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Bell />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
