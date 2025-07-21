"use client"

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface BreakContextType {
  isBreakActive: boolean
  activeBreakId: string | null
  setBreakActive: (active: boolean, breakId?: string) => void
  isInitialized: boolean
}

const BreakContext = createContext<BreakContextType | undefined>(undefined)

// LocalStorage keys for break state persistence
const ACTIVE_BREAK_KEY = 'shoreagents-active-break'
const BREAK_STATE_KEY = 'shoreagents-break-state'

export function BreakProvider({ children }: { children: React.ReactNode }) {
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [activeBreakId, setActiveBreakId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize break state from localStorage on mount
  useEffect(() => {
    const initializeBreakState = () => {
      if (typeof window !== 'undefined') {
        try {
          const savedActiveBreak = localStorage.getItem(ACTIVE_BREAK_KEY)
          const savedBreakState = localStorage.getItem(BREAK_STATE_KEY)
          
          if (savedActiveBreak && savedBreakState === 'true') {
            setIsBreakActive(true)
            setActiveBreakId(savedActiveBreak)
          }
        } catch (error) {
          console.error('Error loading break state:', error)
        }
        setIsInitialized(true)
      }
    }

    // Immediate initialization
    initializeBreakState()

    // Also check after a small delay to ensure DOM is ready
    const timeoutId = setTimeout(initializeBreakState, 100)

    return () => clearTimeout(timeoutId)
  }, [])

  const setBreakActive = useCallback((active: boolean, breakId?: string) => {
    setIsBreakActive(active)
    setActiveBreakId(active ? breakId || null : null)
    
    // Persist to localStorage
    if (typeof window !== 'undefined') {
      try {
        if (active && breakId) {
          localStorage.setItem(ACTIVE_BREAK_KEY, breakId)
          localStorage.setItem(BREAK_STATE_KEY, 'true')
        } else {
          localStorage.removeItem(ACTIVE_BREAK_KEY)
          localStorage.removeItem(BREAK_STATE_KEY)
        }
      } catch (error) {
        console.error('Error saving break state:', error)
      }
    }
  }, [])

  const value = {
    isBreakActive,
    activeBreakId,
    setBreakActive,
    isInitialized
  }

  return (
    <BreakContext.Provider value={value}>
      {children}
    </BreakContext.Provider>
  )
}

export function useBreak() {
  const context = useContext(BreakContext)
  if (context === undefined) {
    throw new Error('useBreak must be used within a BreakProvider')
  }
  return context
} 