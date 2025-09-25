'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw, X, Download } from 'lucide-react'
import { toast } from 'sonner'

interface UpdateNotificationProps {
  className?: string
}

export function UpdateNotification({ className = '' }: UpdateNotificationProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isReloading, setIsReloading] = useState(false)

  const handleReload = () => {
    setIsReloading(true)
    
    // Show a brief loading state
    toast.loading('Restarting app...', {
      id: 'restart-toast'
    })

    // Check if we're in Electron environment
    if (window.electronAPI) {
      // Use Electron API to restart the app
      try {
        // Send restart command to Electron main process
        window.electronAPI.send('restart-app')
        
        // Listen for app restarting confirmation
        window.electronAPI.receive('app-restarting', () => {
          toast.loading('App is restarting...', {
            id: 'restart-toast',
            duration: Infinity // Keep showing until app restarts
          })
        })
      } catch (error) {
        console.error('Failed to restart app via Electron:', error)
        // Fallback to page reload
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      }
    } else {
      // Fallback for browser environment - just reload the page
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    }
  }

  const handleDismiss = useCallback(async () => {
    try {
      // Get the current build time to mark this specific update as dismissed
      const response = await fetch('/api/build-info', { 
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // Mark this specific build as dismissed
        localStorage.setItem('update-dismissed', data.buildTime)
      }
    } catch (error) {
      console.log('Failed to get build info for dismissal:', error)
    }
    
    setUpdateAvailable(false)
    toast.dismiss()
  }, [])

  const showUpdateToast = useCallback(() => {
    // Just set the update available state - the persistent banner will handle the UI
    setUpdateAvailable(true)
  }, [])


  // Check for updates periodically
  useEffect(() => {
    let intervalId: NodeJS.Timeout

    const checkBuildVersion = async () => {
      try {
        const response = await fetch('/api/build-info', { 
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          const currentBuildTime = localStorage.getItem('app-build-time')
          const updateDismissed = localStorage.getItem('update-dismissed')
          
          if (!currentBuildTime) {
            // First time loading, store the build time
            localStorage.setItem('app-build-time', data.buildTime)
          } else if (currentBuildTime !== data.buildTime) {
            // Build time has changed, check if user has dismissed this update
            if (updateDismissed !== data.buildTime) {
              // Update is available and not dismissed
              setUpdateAvailable(true)
              showUpdateToast()
            }
          }
        }
      } catch (error) {
        console.log('Build info check failed:', error)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible, check for updates
        checkBuildVersion()
      }
    }

    const checkForUpdates = async () => {
      try {
        // Check if we're in a browser environment (not Electron)
        if (typeof window !== 'undefined' && !window.electronAPI) {
          // Check if there's a service worker update available
          if ('serviceWorker' in navigator) {
            const registration = await navigator.serviceWorker.getRegistration()
            if (registration) {
              registration.addEventListener('updatefound', () => {
                setUpdateAvailable(true)
                showUpdateToast()
              })
            }
          }

          document.addEventListener('visibilitychange', handleVisibilityChange)

          // Check immediately
          checkBuildVersion()

          // Set up periodic checking every 5 minutes
          intervalId = setInterval(checkBuildVersion, 5 * 60 * 1000)
        }
      } catch (error) {
        console.log('Update check failed:', error)
      }
    }

    checkForUpdates()

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [showUpdateToast])

  // Don't render anything if no update is available
  if (!updateAvailable) {
    return null
  }

  return (
    <>
      {/* Persistent header banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white py-2 px-4 text-center text-sm font-medium">
        <div className="flex items-center justify-center gap-2">
          <Download className="h-4 w-4" />
          <span>Update Available - Please restart the app to get the latest features</span>
          <Button
            size="sm"
            onClick={handleReload}
            disabled={isReloading}
            className="bg-white text-orange-600 hover:bg-orange-50 ml-4"
          >
            {isReloading ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Restarting...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Restart Now
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-white hover:bg-orange-600 ml-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Add CSS to push content down when banner is visible */}
      <style jsx global>{`
        body {
          padding-top: 48px !important;
        }
      `}</style>
    </>
  )
}
