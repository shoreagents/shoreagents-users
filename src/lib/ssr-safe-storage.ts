/**
 * SSR-safe storage utilities
 * These functions safely access localStorage only on the client side
 */

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.warn('Error accessing localStorage:', error)
      return null
    }
  },

  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      console.warn('Error setting localStorage:', error)
    }
  },

  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.warn('Error removing from localStorage:', error)
    }
  },

  clear: (): void => {
    if (typeof window === 'undefined') return
    try {
      localStorage.clear()
    } catch (error) {
      console.warn('Error clearing localStorage:', error)
    }
  },

  getAllKeys: (): string[] => {
    if (typeof window === 'undefined') return []
    try {
      return Object.keys(localStorage)
    } catch (error) {
      console.warn('Error getting localStorage keys:', error)
      return []
    }
  }
}

/**
 * Hook for safely using localStorage in React components
 */
export const useSSRSafeStorage = () => {
  const isClient = typeof window !== 'undefined'
  
  return {
    isClient,
    getItem: safeLocalStorage.getItem,
    setItem: safeLocalStorage.setItem,
    removeItem: safeLocalStorage.removeItem,
    clear: safeLocalStorage.clear,
    getAllKeys: safeLocalStorage.getAllKeys
  }
}
