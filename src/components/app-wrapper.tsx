'use client'

import { useState, useEffect } from 'react'
import { LoadingScreen } from '@/components/loading-screen'
import { useLoading } from '@/contexts/loading-context'

interface AppWrapperProps {
  children: React.ReactNode
}

export function AppWrapper({ children }: AppWrapperProps) {
  const [hasShownLoading, setHasShownLoading] = useState(false)
  const { isLoading, setIsLoading, isLogoutNavigation } = useLoading()

  useEffect(() => {
    // If this is a logout navigation, skip loading screen entirely
    if (isLogoutNavigation) {
      setIsLoading(false)
      setHasShownLoading(true)
      return
    }

    // Check if we've already shown loading for this session
    const hasShown = sessionStorage.getItem('shoreagents-loading-shown')
    
    if (hasShown) {
      setIsLoading(false)
      setHasShownLoading(true)
      return
    }

    // Show loading screen for 2 seconds
    const timer = setTimeout(() => {
      setIsLoading(false)
      setHasShownLoading(true)
      sessionStorage.setItem('shoreagents-loading-shown', 'true')
    }, 2000)

    return () => clearTimeout(timer)
  }, [setIsLoading, isLogoutNavigation])

  // Don't show loading screen on subsequent navigations or logout navigation
  if (hasShownLoading || isLogoutNavigation) {
    return <>{children}</>
  }

  return (
    <>
      {isLoading && (
        <LoadingScreen 
          onComplete={() => setIsLoading(false)}
          duration={2000}
        />
      )}
      {!isLoading && children}
    </>
  )
}
