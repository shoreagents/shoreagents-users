"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'

interface AuthContextType {
  hasLoggedIn: boolean
  setUserLoggedIn: () => void
  setUserLoggedOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [hasLoggedIn, setHasLoggedIn] = useState(false)

  // Check for existing login on mount
  useEffect(() => {
    const checkInitialAuth = async () => {
      const currentUser = getCurrentUser()
      if (currentUser) {
        // Only set hasLoggedIn if we're not on the login page or root page
        if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
          setHasLoggedIn(true)
        }
      } else {
        setHasLoggedIn(false)
      }
    }
    
    // Add a small delay to ensure all contexts are properly initialized
    const timeoutId = setTimeout(checkInitialAuth, 200)
    
    return () => clearTimeout(timeoutId)
  }, [])

  // Monitor authentication state continuously
  useEffect(() => {
    const checkAuthStatus = async () => {
      const currentUser = getCurrentUser()
      const isOnLoginPage = window.location.pathname === '/' || window.location.pathname === '/login'
      
      if (!currentUser) {
        // User is not logged in
        if (hasLoggedIn) {
          setHasLoggedIn(false)
        }
      } else {
        // User is logged in
        if (!hasLoggedIn && !isOnLoginPage) {
          setHasLoggedIn(true)
        }
      }
    }

    // Check auth status immediately
    checkAuthStatus()

    // Set up an interval to check auth status more frequently - OPTIMIZED: Reduced frequency
    const authCheckInterval = setInterval(checkAuthStatus, 5000) // OPTIMIZED: Check every 5 seconds instead of 1

    return () => clearInterval(authCheckInterval)
  }, [hasLoggedIn])

  const setUserLoggedIn = () => {
    console.log('User logging in - will start activity tracking')
    setHasLoggedIn(true)
    
    // Add a small delay to ensure authentication data is stored, then reload the page
    // This ensures the timer initializes properly after login
    setTimeout(() => {
      if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
        console.log('🔄 Reloading page after login to ensure timer initialization')
        window.location.reload()
      }
    }, 1000) // 1 second delay to ensure all data is stored
  }

  const setUserLoggedOut = () => {
    console.log('🔄 User logging out - stopping activity tracking')
    setHasLoggedIn(false)
    console.log('✅ User logged out successfully')
  }

  const value = {
    hasLoggedIn,
    setUserLoggedIn,
    setUserLoggedOut
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
