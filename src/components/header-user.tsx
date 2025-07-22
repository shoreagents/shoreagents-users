"use client"

import { useRouter } from "next/navigation"
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  LogOut,
  Power,
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

  const handleLogout = () => {
    // Clear authentication data first
    localStorage.removeItem("shoreagents-auth")
    
    // Clear cookie
    document.cookie = "shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
    
    // Stop activity tracking (this will be picked up by the auth monitor)
    setUserLoggedOut()
    
    // Redirect to login
    router.push("/login")
  }

  const handleLogoutAndQuit = async () => {
    // Only available in Electron
    if (typeof window !== 'undefined' && window.electronAPI?.app?.confirmLogoutAndQuit) {
      try {
        await window.electronAPI.app.confirmLogoutAndQuit()
      } catch (error) {
        console.error('Error triggering logout and quit:', error)
        // Fallback to regular logout
        handleLogout()
      }
    } else {
      // Fallback to regular logout if not in Electron
      handleLogout()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full cursor-pointer">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
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
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
        {typeof window !== 'undefined' && window.electronAPI && (
          <DropdownMenuItem onClick={handleLogoutAndQuit}>
            <Power className="mr-2 h-4 w-4" />
            <span>Logout & Quit App</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 