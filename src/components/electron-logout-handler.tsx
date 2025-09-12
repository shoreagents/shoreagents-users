'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
// import { forceSaveAndReload } from '@/lib/activity-storage'
import { getCurrentUser } from '@/lib/ticket-utils'
import { hasOngoingMeeting, endMeeting } from '@/lib/meeting-utils'

export default function ElectronLogoutHandler() {
  const router = useRouter()

  // Monitor authentication state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.app) {
             const checkAuthState = async () => {
         try {
           const authData = localStorage.getItem('shoreagents-auth')
           if (!authData) {
             if (window.electronAPI?.app?.userLoggedOut) {
               await window.electronAPI.app.userLoggedOut()
             }
             return
           }
           
           const parsed = JSON.parse(authData)
           const userActuallyLoggedIn = parsed.isAuthenticated === true && parsed.user?.email
          
          if (userActuallyLoggedIn && window.electronAPI?.app?.userLoggedIn) {
            await window.electronAPI.app.userLoggedIn()
          } else if (!userActuallyLoggedIn && window.electronAPI?.app?.userLoggedOut) {
            await window.electronAPI.app.userLoggedOut()
          }
        } catch (error) {
          console.error('Error updating tray menu auth state:', error)
        }
      }

      // Delay initial check to ensure IPC handlers are ready
      const initialTimeout = setTimeout(checkAuthState, 2000)

             // Monitor localStorage changes
       const handleStorageChange = (e: StorageEvent) => {
         if (e.key === 'shoreagents-auth') {
           setTimeout(checkAuthState, 100) // Small delay to ensure all changes are applied
         }
       }

      window.addEventListener('storage', handleStorageChange)

      // Also check periodically in case localStorage changes don't trigger events
      const interval = setInterval(checkAuthState, 10000) // Less frequent to avoid spam

      return () => {
        clearTimeout(initialTimeout)
        window.removeEventListener('storage', handleStorageChange)
        clearInterval(interval)
      }
    }
  }, [])

  useEffect(() => {
    // Only run in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Handle force logout before quit
      const handleForceLogout = async () => {
        try {
          // Get current user before clearing auth
          const currentUser = getCurrentUser()
          
          // Check if user has an ongoing meeting and end it
          if (currentUser?.email) {
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
              console.error('Error ending meeting during force logout:', error)
              // Continue with logout even if meeting cleanup fails
            }
          }
          
          // Force save all activity data and reload page before logout
          if (currentUser?.email) {
            // TODO: Replace with database-driven save and reload
            // forceSaveAndReload(currentUser.email)
            return // The page will reload, so don't continue with logout
          }
          
          // Fallback: Clear authentication data (using the actual auth storage)
          localStorage.removeItem('shoreagents-auth')
          
          // Clear cookie
          document.cookie = "shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
          
          // Clear any session data
          localStorage.removeItem('sessionData')
          localStorage.removeItem('currentSessionStart')
          
          // Notify Electron that logout is complete
          if (window.electronAPI?.app?.logoutCompleted) {
            await window.electronAPI.app.logoutCompleted()
          }
        } catch (error) {
          console.error('Error during forced logout:', error)
          // Still notify Electron even if there's an error
          if (window.electronAPI?.app?.logoutCompleted) {
            await window.electronAPI.app.logoutCompleted()
          }
        }
      }

             // Handle navigation requests from tray menu
       const handleNavigateTo = (path: string) => {
         router.push(path)
       }

      // Set up listeners
      window.electronAPI.receive('force-logout-before-quit', handleForceLogout)
      window.electronAPI.receive('navigate-to', handleNavigateTo)

             // Cleanup on unmount
       return () => {
         if (window.electronAPI?.removeAllListeners) {
           window.electronAPI.removeAllListeners('force-logout-before-quit')
           window.electronAPI.removeAllListeners('navigate-to')
         }
       }
    }
  }, [router])

  // This component doesn't render anything
  return null
} 