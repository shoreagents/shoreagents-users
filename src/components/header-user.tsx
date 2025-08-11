"use client"

import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
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
import { getCurrentUser } from "@/lib/ticket-utils"
import { hasOngoingMeeting, endMeeting } from "@/lib/meeting-utils"
import { forceLogout } from "@/lib/auth-utils"

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

  const handleLogout = async () => {
    console.log('🔄 Logout button clicked (header)')
    
    // Get current user before clearing auth
    const currentUser = getCurrentUser()
    console.log('👤 Current user (header):', currentUser)
    
    // Check if user has an ongoing meeting and end it
    try {
      const hasOngoing = await hasOngoingMeeting()
      if (hasOngoing) {
        console.log('📞 User has ongoing meeting - ending it before logout')
        
        // Get meetings to find the active one
        const { getMeetings } = await import('@/lib/meeting-utils')
        const meetings = await getMeetings()
        const activeMeeting = meetings.find(m => m.status === 'in-progress')
        
        if (activeMeeting) {
          await endMeeting(activeMeeting.id)
          console.log('✅ Active meeting ended successfully before logout')
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
    
    // Redirect to login
    router.push("/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>AU</AvatarFallback>
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
          <DropdownMenuItem>
            <BadgeCheck className="mr-2 h-4 w-4" />
            <span>Account</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Bell className="mr-2 h-4 w-4" />
            <span>Notifications</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 