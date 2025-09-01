"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

interface LogoutContextType {
  isLoggingOut: boolean
  startLogout: () => void
  finishLogout: () => void
}

const LogoutContext = createContext<LogoutContextType | undefined>(undefined)

export function LogoutProvider({ children }: { children: React.ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startLogout = useCallback(() => {
    // Prevent multiple logout states
    if (isLoggingOut) return
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    setIsLoggingOut(true)
    
    // Safety timeout: automatically finish logout after 10 seconds
    // This prevents the loading state from getting stuck
    timeoutRef.current = setTimeout(() => {
      setIsLoggingOut(false)
      timeoutRef.current = null
    }, 10000)
  }, [isLoggingOut])

  const finishLogout = useCallback(() => {
    setIsLoggingOut(false)
  }, [])

  // Listen for logout finished event from auth-utils
  useEffect(() => {
    const handleLogoutFinished = () => {
      finishLogout()
    }

    window.addEventListener('logout-finished', handleLogoutFinished)
    
    // Safety mechanism: if user navigates away or page unloads, finish logout
    const handleBeforeUnload = () => {
      finishLogout()
    }
    
    const handlePageHide = () => {
      finishLogout()
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    
    return () => {
      window.removeEventListener('logout-finished', handleLogoutFinished)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [finishLogout])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return (
    <LogoutContext.Provider value={{ isLoggingOut, startLogout, finishLogout }}>
      {children}
    </LogoutContext.Provider>
  )
}

export function useLogout() {
  const context = useContext(LogoutContext)
  if (context === undefined) {
    throw new Error('useLogout must be used within a LogoutProvider')
  }
  return context
}
