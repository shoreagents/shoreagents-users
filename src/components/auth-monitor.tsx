"use client"

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, hasValidAuthTokens, forceLogout } from '@/lib/auth-utils'

interface AuthMonitorProps {
  children: React.ReactNode
}

export function AuthMonitor({ children }: AuthMonitorProps) {
  const router = useRouter()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastCheckRef = useRef<{
    shoreagentsAuth: string | null
    supabaseAuth: string | null
    cookies: string | null
  }>({
    shoreagentsAuth: null,
    supabaseAuth: null,
    cookies: null
  })

  // Function to get current auth state
  const getCurrentAuthState = () => {
    const shoreagentsAuth = localStorage.getItem('shoreagents-auth')
    const supabaseAuth = localStorage.getItem('sb-sanljwkkoawwdpaxrper-auth-token')
    
    // Get cookies (simplified - you might want to use a cookie library)
    const cookies = document.cookie
    const shoreagentsCookie = cookies.split(';').find(cookie => 
      cookie.trim().startsWith('shoreagents-auth=')
    )?.split('=')[1] || null

    return {
      shoreagentsAuth,
      supabaseAuth,
      cookies: shoreagentsCookie
    }
  }

  // Function to clear all auth tokens
  const clearAllAuthTokens = () => {
    console.log('🧹 Clearing all authentication tokens...')
    
    // Clear localStorage
    localStorage.removeItem('shoreagents-auth')
    localStorage.removeItem('sb-sanljwkkoawwdpaxrper-auth-token')
    
    // Clear cookies
    document.cookie = 'shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'sb-sanljwkkoawwdpaxrper-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    
    // Clear sessionStorage
    sessionStorage.clear()
  }

  // Function to check if user should be logged out
  const checkAuthStatus = () => {
    const currentUser = getCurrentUser()
    const currentAuth = getCurrentAuthState()
    
    // If no current user, check if we had auth before
    if (!currentUser) {
      const hadAuthBefore = lastCheckRef.current.shoreagentsAuth || 
                           lastCheckRef.current.supabaseAuth || 
                           lastCheckRef.current.cookies
      
      if (hadAuthBefore) {
        console.log('🚪 Auto-logout: Authentication tokens removed')
        clearAllAuthTokens()
        forceLogout()
        return
      }
    }

    // Check if any auth tokens were removed
    const shoreagentsAuthRemoved = lastCheckRef.current.shoreagentsAuth && !currentAuth.shoreagentsAuth
    const supabaseAuthRemoved = lastCheckRef.current.supabaseAuth && !currentAuth.supabaseAuth
    const cookiesRemoved = lastCheckRef.current.cookies && !currentAuth.cookies

    if (shoreagentsAuthRemoved || supabaseAuthRemoved || cookiesRemoved) {
      console.log('🚪 Auto-logout: Authentication token deleted - clearing all auth data')
      
      // Clear all remaining auth tokens
      clearAllAuthTokens()
      
      // Force logout
      forceLogout()
      return
    }

    // Update last check state
    lastCheckRef.current = currentAuth
  }

  // Function to handle storage events (for cross-tab detection)
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'shoreagents-auth' || e.key === 'sb-sanljwkkoawwdpaxrper-auth-token') {
      console.log('🚪 Storage change detected:', e.key, e.newValue)
      
      if (!e.newValue) {
        // Token was removed in another tab
        console.log('🚪 Auto-logout: Token removed in another tab - clearing all auth data')
        clearAllAuthTokens()
        forceLogout()
      }
    }
  }

  useEffect(() => {
    // Initialize auth state
    const currentAuth = getCurrentAuthState()
    lastCheckRef.current = currentAuth

    // Set up periodic checking
    intervalRef.current = setInterval(checkAuthStatus, 1000) // Check every second

    // Listen for storage events (cross-tab detection)
    window.addEventListener('storage', handleStorageChange)

    // Listen for beforeunload to detect manual clearing
    const handleBeforeUnload = () => {
      // This is a backup - the interval will catch most cases
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [router])

  return <>{children}</>
} 