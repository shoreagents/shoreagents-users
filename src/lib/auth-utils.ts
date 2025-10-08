// Authentication utilities
import { authHelpers } from './supabase'

// Helper function to check if running in Electron
const isElectronApp = () => {
  return typeof window !== 'undefined' && window.electronAPI
}

// Remember me functionality using Electron's secure storage
// This stores credentials securely using the system keychain when available
export const setRememberedCredentials = async (email: string, password: string) => {
  try {
    // Basic validation
    if (!email || !password || email.trim() === '' || password.trim() === '') {
      console.warn('Invalid credentials provided for remembering')
      return
    }
    
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI?.secureCredentials) {
      try {
        // Use Electron's secure storage
        const result = await window.electronAPI.secureCredentials.store(email.trim(), password.trim())
        if (result.success) {
          return
        } else {
          console.warn('Electron secure storage failed, falling back to localStorage:', result.error)
        }
      } catch (error) {
        console.warn('Electron secure storage error, falling back to localStorage:', error)
      }
    }
    
    // Fallback to localStorage if Electron storage is not available
    const credentials = { 
      email: email.trim(), 
      password: password.trim(), 
      timestamp: Date.now(),
      version: '1.0' // For future compatibility
    }
    
    localStorage.setItem('shoreagents-remembered', JSON.stringify(credentials))
    
    // Also store in a separate cookie for cross-tab access
    const expires = new Date()
    expires.setTime(expires.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year
    const value = encodeURIComponent(JSON.stringify(credentials))
    document.cookie = `shoreagents-remembered=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`
    
  } catch (error) {
    console.error('Error remembering credentials:', error)
  }
}

export const getRememberedCredentials = async () => {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && window.electronAPI?.secureCredentials) {
      try {
        // Use Electron's secure storage
        const result = await window.electronAPI.secureCredentials.get()
        if (result.success && result.credentials) {
          // Check if credentials are not too old (max 1 year)
          if (Date.now() - result.credentials.timestamp < 365 * 24 * 60 * 60 * 1000) {
            return result.credentials
          } else {
            await window.electronAPI.secureCredentials.clear()
            return null
          }
        } else {
          console.warn('No secure credentials found or error:', result.error)
        }
      } catch (error) {
        console.warn('Electron secure storage error, falling back to localStorage:', error)
      }
    }
    
    // Fallback to localStorage if Electron storage is not available
    const localCredentials = localStorage.getItem('shoreagents-remembered')
    if (localCredentials) {
      const parsed = JSON.parse(localCredentials)
      // Check if credentials are not too old (max 1 year)
      if (Date.now() - parsed.timestamp < 365 * 24 * 60 * 60 * 1000) {
        return parsed
      }
    }
    
    // Fallback to cookie
    const cookies = document.cookie.split(';')
    const rememberedCookie = cookies.find(cookie => cookie.trim().startsWith('shoreagents-remembered='))
    
    if (rememberedCookie) {
      const cookieValue = rememberedCookie.split('=')[1]
      const parsed = JSON.parse(decodeURIComponent(cookieValue))
      // Check if credentials are not too old (max 1 year)
      if (Date.now() - parsed.timestamp < 365 * 24 * 60 * 60 * 1000) {
        return parsed
      }
    }
    
    return null
  } catch (error) {
    console.error('Error getting remembered credentials:', error)
    return null
  }
}

export const clearRememberedCredentials = async () => {
  try {
    // Clear Electron secure storage if available
    if (typeof window !== 'undefined' && window.electronAPI?.secureCredentials) {
      try {
        await window.electronAPI.secureCredentials.clear()
      } catch (error) {
        console.warn('Error clearing secure credentials:', error)
      }
    }
    
    // Clear localStorage fallback
    localStorage.removeItem('shoreagents-remembered')
    document.cookie = 'shoreagents-remembered=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  } catch (error) {
    console.error('Error clearing remembered credentials:', error)
  }
}

// Get security information about remember me functionality
export const getRememberMeSecurityInfo = () => {
  return {
    isElectron: isElectronApp(),
    warning: isElectronApp() 
      ? "Credentials are stored locally on your computer. Keep your device secure."
      : "Credentials are stored in your browser. Keep your device secure.",
    recommendation: "Only use this feature on your personal, secure device."
  }
}

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
    if (typeof window !== 'undefined') {
      // Get current user email for socket event
      const currentUser = getCurrentUser();
      const email = currentUser?.email;
      
      if (email) {
        // Dispatch logout event for socket server
        const event = new CustomEvent('user-logout', { 
          detail: { 
            email,
            timestamp: new Date().toISOString(),
            reason: 'manual_logout'
          } 
        });
        window.dispatchEvent(event);
        
        // Wait a bit for the socket event to be processed before redirecting
        setTimeout(() => {
          performLogoutCleanup();
        }, 500); // Wait 500ms for socket to process logout
        
        return; // Exit early, cleanup will happen in timeout
      }
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
  
  // Fallback: perform immediate cleanup if no socket handling
  performLogoutCleanup();
}

/**
 * Perform the actual logout cleanup and redirect
 */
function performLogoutCleanup() {
  
  // Clear all notifications on logout
  try {
    const { clearAllNotificationsOnLogout } = require('./notification-service');
    clearAllNotificationsOnLogout();
  } catch (error) {
    console.warn('Could not clear notifications on logout:', error);
  }

  // Set activity_data is_currently_active to false on logout
  try {
    const currentUser = getCurrentUser();
    const email = currentUser?.email;
    
    if (email) {
      const requestBody = JSON.stringify({ isCurrentlyActive: false });
      
      fetch(`/api/activity/update-status?email=${encodeURIComponent(email)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
        credentials: 'include'
      }).then(response => {
        if (!response.ok) {
          console.warn('Activity status update failed:', response.status, response.statusText);
        }
      }).catch(error => {
        console.warn('Could not update activity status on logout:', error);
      });
    } else {
      console.warn('No email found for current user, skipping activity status update');
    }
  } catch (error) {
    console.warn('Could not update activity status on logout:', error);
  }
  
  // Clear localStorage
  localStorage.removeItem('shoreagents-auth')
  localStorage.removeItem('sb-sanljwkkoawwdpaxrper-auth-token')
  
  // Clear cookies
  document.cookie = 'shoreagents-auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  document.cookie = 'sb-sanljwkkoawwdpaxrper-auth-token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
  
  // Set flag to indicate this is a logout navigation (use localStorage so it persists)
  if (typeof window !== 'undefined') {
    localStorage.setItem('shoreagents-logout-navigation', 'true')
  }
  
  // Clear sessionStorage
  sessionStorage.clear()
  
  // Note: We don't clear remembered credentials here to preserve the "Remember me" functionality
  // Users can still use remembered credentials after logout
  
  
  // Dispatch logout finished event for the logout context
  if (typeof window !== 'undefined') {
    const event = new CustomEvent('logout-finished');
    window.dispatchEvent(event);
  }
  
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

// Clear all auth artifacts including remembered credentials (used during logout)
export function clearAllAuthArtifactsIncludingRemembered() {
  clearAllAuthArtifacts()
  clearRememberedCredentials()
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
  
} 