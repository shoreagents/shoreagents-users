// Authentication utilities
import { authHelpers } from './supabase'

export const setAuthCookie = (authData: any, days: number = 7) => {
  const expires = new Date()
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
  // Encode to ensure cookie-safe characters and reduce parse errors in middleware
  const value = encodeURIComponent(JSON.stringify(authData))
  document.cookie = `shoreagents-auth=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

export const clearAuthCookie = () => {
  document.cookie = "shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;"
}

export const getAuthCookie = () => {
  const cookies = document.cookie.split(';')
  const authCookie = cookies.find(cookie => cookie.trim().startsWith('shoreagents-auth='))
  
  if (authCookie) {
    try {
      const cookieValue = authCookie.split('=')[1]
      return JSON.parse(decodeURIComponent(cookieValue))
    } catch (error) {
      console.error('Error parsing auth cookie:', error)
      clearAuthCookie() // Clear invalid cookie
      return null
    }
  }
  
  return null
}

export const isAuthenticated = () => {
  const authData = getAuthCookie()
  return authData && authData.isAuthenticated === true
}

export const getCurrentUser = () => {
  const authData = getAuthCookie()
  if (!authData?.user) return null
  
  const user = authData.user
  
  // For hybrid authentication, prioritize Railway ID for database operations
  if (authData.hybrid && user.railway_id) {
    return {
      ...user,
      id: user.railway_id, // Use Railway ID for database queries
      supabase_id: user.id, // Keep Supabase ID for reference
    }
  }
  
  return user
}

// Helper function to check if we need to refresh auth data format
export const refreshAuthDataFormat = () => {
  const authData = getAuthCookie()
  const localAuthData = localStorage.getItem("shoreagents-auth")
  
  // If we have hybrid auth data but localStorage still has old format, update it
  if (authData?.hybrid && localAuthData) {
    try {
      const parsed = JSON.parse(localAuthData)
      if (!parsed.hybrid && authData.user?.railway_id) {
        console.log('Updating localStorage auth format for hybrid authentication')
        localStorage.setItem("shoreagents-auth", JSON.stringify(authData))
      }
    } catch (error) {
      console.error('Error updating auth data format:', error)
    }
  }
}

/**
 * Normalize Auth on app entry. Ensures localStorage and cookie are aligned
 * to avoid double-login redirects after long idle sessions or forced logouts.
 */
export function normalizeAuthOnEntry() {
  try {
    const cookieAuth = getAuthCookie()
    const lsAuthRaw = localStorage.getItem('shoreagents-auth')
    const lsAuth = lsAuthRaw ? JSON.parse(lsAuthRaw) : null
    // If cookie shows authenticated but localStorage is empty or out-of-date, sync it
    if (cookieAuth?.isAuthenticated && JSON.stringify(lsAuth) !== JSON.stringify(cookieAuth)) {
      localStorage.setItem('shoreagents-auth', JSON.stringify(cookieAuth))
    }
    // If cookie was cleared but localStorage still has auth, clear LS to prevent loops
    if (!cookieAuth && lsAuth) {
      localStorage.removeItem('shoreagents-auth')
    }
  } catch {}
}

/**
 * Clear all authentication data and redirect to login
 */
export function forceLogout() {
  // Emit logout event to socket server before clearing auth data
  try {
    // Get socket instance from global scope or emit event
    if (typeof window !== 'undefined') {
      // Try to emit logout event to socket if available
      const event = new CustomEvent('user-logout', { 
        detail: { 
          timestamp: new Date().toISOString(),
          reason: 'manual_logout'
        } 
      });
      window.dispatchEvent(event);
      
      console.log('🚪 Logout event dispatched - socket server will mark user as offline');
    }
  } catch (error) {
    console.log('Socket logout event failed (socket may not be connected):', error);
  }
  
  // Clear localStorage
  localStorage.removeItem('shoreagents-auth')
  localStorage.removeItem('sb-sanljwkkoawwdpaxrper-auth-token')
  
  // Clear cookies
  document.cookie = 'shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  document.cookie = 'sb-sanljwkkoawwdpaxrper-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  
  // Clear sessionStorage
  sessionStorage.clear()
  
  // Redirect to login
  window.location.href = '/login'
}

// Clear all auth artifacts without redirect (used before login to avoid stale state)
export function clearAllAuthArtifacts() {
  try {
    localStorage.removeItem('shoreagents-auth')
    localStorage.removeItem('sb-sanljwkkoawwdpaxrper-auth-token')
  } catch {}
  try {
    document.cookie = 'shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    document.cookie = 'sb-sanljwkkoawwdpaxrper-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  } catch {}
  try { sessionStorage.clear() } catch {}
}

/**
 * Check if user has valid authentication tokens
 */
export function hasValidAuthTokens(): boolean {
  const user = getCurrentUser()
  const shoreagentsAuth = localStorage.getItem('shoreagents-auth')
  const supabaseAuth = localStorage.getItem('sb-sanljwkkoawwdpaxrper-auth-token')
  
  return !!(user && (shoreagentsAuth || supabaseAuth))
}

/**
 * Get all authentication tokens for debugging
 */
export function getAuthTokens() {
  return {
    shoreagentsAuth: localStorage.getItem('shoreagents-auth'),
    supabaseAuth: localStorage.getItem('sb-sanljwkkoawwdpaxrper-auth-token'),
    cookies: document.cookie,
    currentUser: getCurrentUser()
  }
}

/**
 * Clear specific authentication token (with cascading delete)
 */
export function clearAuthToken(tokenName: 'shoreagents-auth' | 'sb-sanljwkkoawwdpaxrper-auth-token') {
  console.log(`🧹 Clearing ${tokenName} and all related auth tokens...`)
  
  // Clear the specific token
  localStorage.removeItem(tokenName)
  
  // Clear ALL auth tokens (cascading delete)
  localStorage.removeItem('shoreagents-auth')
  localStorage.removeItem('sb-sanljwkkoawwdpaxrper-auth-token')
  
  // Clear ALL cookies
  document.cookie = 'shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  document.cookie = 'sb-sanljwkkoawwdpaxrper-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  
  // Clear sessionStorage
  sessionStorage.clear()
  
  console.log('✅ All authentication tokens cleared')
} 