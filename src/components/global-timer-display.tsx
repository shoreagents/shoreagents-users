"use client"

import { useState } from 'react'
import { useTimer } from '@/contexts/timer-context'
import { Button } from '@/components/ui/button'
import { ChevronUp, ChevronDown, Pause } from 'lucide-react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { usePathname } from 'next/navigation'

export function GlobalTimerDisplay() {
  const [isVisible, setIsVisible] = useState(true)
  const pathname = usePathname()
  const { 
    timerData, 
    connectionStatus, 
    error, 
    isAuthenticated,
    liveActiveSeconds,
    liveInactiveSeconds,
    isBreakActive,
    breakStatus
  } = useTimer()

  // Utility function to format seconds into readable time
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${remainingSeconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    } else {
      return `${remainingSeconds}s`
    }
  }

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-400'
    }
  }

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'error':
        return 'Error'
      default:
        return 'Disconnected'
    }
  }

  // Check if user is authenticated and logged in
  const currentUser = getCurrentUser()
  
  // Don't show timer on login page or if not authenticated
  if (pathname === '/login' || pathname === '/' || !isAuthenticated || !currentUser) {
    return null
  }

  return (
    <>
      {/* Toggle Button - Always visible */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          size="sm"
                     className={`backdrop-blur-sm shadow-lg border rounded-full w-10 h-10 p-0 ${
             isVisible 
               ? 'bg-white/90' 
               : isBreakActive
               ? 'bg-yellow-100 border-yellow-300'
               : timerData?.isActive 
                 ? 'bg-green-100 border-green-300' 
                 : 'bg-red-100 border-red-300'
           }`}
          title={isVisible ? "Collapse Timer" : "Expand Timer"}
        >
          {isVisible ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
                         <div className="relative">
               <ChevronUp className="w-4 h-4" />
               <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                 isBreakActive 
                   ? 'bg-yellow-500' 
                   : timerData?.isActive 
                   ? 'bg-green-500' 
                   : 'bg-red-500'
               } animate-pulse`}></div>
             </div>
          )}
        </Button>
      </div>

      {/* Timer Display - Conditionally visible */}
      {isVisible && (
        <div className="fixed bottom-4 right-16 bg-white rounded-lg shadow-lg border p-4 min-w-[300px] z-50">
          {connectionStatus === 'connecting' && (
            <div className="absolute inset-0 bg-white/90 rounded-lg flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                Reconnecting...
              </div>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Global Activity Timer</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></span>
              <span className="text-xs text-gray-500">{getConnectionStatusText()}</span>
            </div>
          </div>

          {timerData ? (
            <div className="space-y-2">
                             <div className="flex items-center justify-between">
                 <span className="text-xs text-gray-600">Status:</span>
                                   <span className={`px-2 py-1 rounded text-xs font-medium ${
                    isBreakActive && breakStatus?.is_paused
                      ? 'bg-green-100 text-green-800'
                      : isBreakActive
                      ? 'bg-yellow-100 text-yellow-800'
                      : timerData.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {isBreakActive && breakStatus?.is_paused
                      ? 'Emergency Pause'
                      : isBreakActive 
                      ? (breakStatus?.break_type ? `${breakStatus.break_type} Break` : 'On Break')
                      : (timerData.isActive ? 'Active' : 'Inactive')
                    }
                  </span>
               </div>
              
                             <div className="grid grid-cols-2 gap-3">
                 <div className={`p-2 rounded ${isBreakActive ? 'bg-gray-50' : 'bg-green-50'}`}>
                   <div className={`text-xs font-medium ${isBreakActive ? 'text-gray-500' : 'text-green-700'}`}>
                     Active
                   </div>
                   <div className={`text-lg font-bold ${isBreakActive ? 'text-gray-400' : 'text-green-600'}`}>
                     {formatTime(liveActiveSeconds)}
                   </div>
                                       {timerData.isActive && !isBreakActive && (
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                        Counting...
                      </div>
                    )}
                    {isBreakActive && !breakStatus?.is_paused && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        On Break
                      </div>
                    )}
                    {isBreakActive && breakStatus?.is_paused && (
                      <div className="text-xs text-green-600 flex items-center gap-1">
                        <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></span>
                        Emergency Pause - Counting
                      </div>
                    )}
                 </div>
                 
                 <div className={`p-2 rounded ${isBreakActive ? 'bg-gray-50' : 'bg-red-50'}`}>
                   <div className={`text-xs font-medium ${isBreakActive ? 'text-gray-500' : 'text-red-700'}`}>
                     Inactive
                   </div>
                   <div className={`text-lg font-bold ${isBreakActive ? 'text-gray-400' : 'text-red-600'}`}>
                     {formatTime(liveInactiveSeconds)}
                   </div>
                                       {!timerData.isActive && !isBreakActive && (
                      <div className="text-xs text-red-600 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Counting...
                      </div>
                    )}
                    {isBreakActive && !breakStatus?.is_paused && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Pause className="w-3 h-3" />
                        On Break
                      </div>
                    )}
                    {isBreakActive && breakStatus?.is_paused && (
                      <div className="text-xs text-red-600 flex items-center gap-1">
                        <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse"></span>
                        Emergency Pause - Counting
                      </div>
                    )}
                 </div>
               </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Loading timer data...</div>
          )}

          {error && (
            <div className="mt-2 text-xs text-red-600">
              Error: {error}
            </div>
          )}
        </div>
      )}
    </>
  )
} 