"use client"

import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  Info,
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
import { Button } from "@/components/ui/button"
import { useActivity } from "@/contexts/activity-context"
import { useLogout } from "@/contexts/logout-context"
import { getCurrentUser } from "@/lib/ticket-utils"
import { hasOngoingMeeting, endMeeting } from "@/lib/meeting-utils"
import { forceLogout } from "@/lib/auth-utils"
import { VersionInfoDialog } from "@/components/version-info-dialog"

export function HeaderUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar: string
  }
}) {
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
    
    // Use the new forceLogout utility function
    forceLogout()
    
    // Stop activity tracking (this will be picked up by the auth monitor)
    setUserLoggedOut()
    
    // Note: forceLogout will handle the redirect, so we don't need router.push here
    // The logout loading state will be cleared by the logout-finished event
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer">
          <Avatar className="h-8 w-8 dark:bg-gray-800 bg-gray-200">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{getInitials(user.name, user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push('/notifications')} className="cursor-pointer">
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
          </DropdownMenuItem>
          <VersionInfoDialog>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="cursor-pointer">
              <Info className="mr-2 h-4 w-4" />
              <span>App Version</span>
            </DropdownMenuItem>
          </VersionInfoDialog>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 