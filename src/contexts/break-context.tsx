"use client"

import React, { createContext, useContext, useState, useCallback } from 'react'

interface BreakContextType {
  isBreakActive: boolean
  activeBreakId: string | null
  setBreakActive: (active: boolean, breakId?: string) => void
}

const BreakContext = createContext<BreakContextType | undefined>(undefined)

export function BreakProvider({ children }: { children: React.ReactNode }) {
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [activeBreakId, setActiveBreakId] = useState<string | null>(null)

  const setBreakActive = useCallback((active: boolean, breakId?: string) => {
    setIsBreakActive(active)
    setActiveBreakId(active ? breakId || null : null)
  }, [])

  const value = {
    isBreakActive,
    activeBreakId,
    setBreakActive
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