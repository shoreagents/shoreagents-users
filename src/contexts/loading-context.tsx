'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

interface LoadingContextType {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  isLogoutNavigation: boolean
  setIsLogoutNavigation: (isLogout: boolean) => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isLogoutNavigation, setIsLogoutNavigation] = useState(false)

  // Check if we're coming from a logout navigation
  useEffect(() => {
    // Check if this is a logout navigation by looking for a special flag
    const isLogoutNav = localStorage.getItem('shoreagents-logout-navigation') === 'true'
    if (isLogoutNav) {
      setIsLogoutNavigation(true)
      setIsLoading(false) // Skip loading screen for logout navigation
      // Clear the flag so it doesn't affect future navigations
      localStorage.removeItem('shoreagents-logout-navigation')
    }
  }, [])

  return (
    <LoadingContext.Provider value={{ 
      isLoading, 
      setIsLoading, 
      isLogoutNavigation, 
      setIsLogoutNavigation 
    }}>
      {children}
    </LoadingContext.Provider>
  )
}

export function useLoading() {
  const context = useContext(LoadingContext)
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }
  return context
}
