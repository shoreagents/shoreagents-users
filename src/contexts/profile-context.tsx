"use client"

import React, { createContext, useContext, ReactNode } from 'react'
import { useProfile } from '@/hooks/use-profile'

interface ProfileContextType {
  profile: any
  isLoading: boolean
  error: any
  isCached: boolean
  refreshProfile: () => Promise<void>
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const profileData = useProfile()

  return (
    <ProfileContext.Provider value={profileData}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfileContext() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfileContext must be used within a ProfileProvider')
  }
  return context
}
