"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/ticket-utils'
import { useLoading } from '@/contexts/loading-context'

export interface TutorialStep {
  id: string
  title: string
  description: string
  target: string // CSS selector for the element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center'
  action?: 'click' | 'hover' | 'none'
  order: number
}

export interface TutorialContextType {
  isTutorialActive: boolean
  currentStep: number
  steps: TutorialStep[]
  isCompleted: boolean
  startTutorial: () => void
  nextStep: () => void
  previousStep: () => void
  skipTutorial: () => void
  completeTutorial: () => void
  resetTutorial: () => void
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined)

// Define tutorial steps
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ShoreAgents!',
    description: 'Let\'s take a quick tour of the main features to help you get started.',
    target: 'body',
    position: 'center',
    action: 'none',
    order: 1
  },
  {
    id: 'sidebar',
    title: 'Navigation Sidebar',
    description: 'This is your main navigation. Here you can access Dashboard, Support Tickets, Productivity tools, and status settings.',
    target: '[data-sidebar]',
    position: 'right',
    action: 'none',
    order: 2
  },
  {
    id: 'quick-actions',
    title: 'Quick Actions',
    description: 'Quick access to common tasks like creating new tickets, taking restroom and breaks.',
    target: '[data-quick-actions]',
    position: 'top',
    action: 'none',
    order: 3
  },
  {
    id: 'search',
    title: 'Global Search',
    description: 'Search for tickets, tasks, meetings, and more. Use Ctrl+K (or Cmd+K on Mac) as a shortcut.',
    target: '[data-search-trigger]',
    position: 'bottom',
    action: 'none',
    order: 4
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Click here to view your notifications. The red badge shows unread count.',
    target: '[data-notifications-trigger]',
    position: 'bottom',
    action: 'none',
    order: 5
  },
  {
    id: 'restroom-button',
    title: 'Restroom Quick Action',
    description: 'This floating button lets you quickly update your restroom status. You can drag it to reposition.',
    target: '[data-restroom-quick-action]',
    position: 'left',
    action: 'none',
    order: 6
  },
  {
    id: 'activity-timer',
    title: 'Activity Timer',
    description: 'Your activity timer tracks your work time. It automatically starts when you\'re active and stops when idle.',
    target: '[data-activity-timer]',
    position: 'top',
    action: 'none',
    order: 7
  },
  {
    id: 'team-status',
    title: 'Team Status',
    description: 'See how many team members are online. Click to view detailed team status.',
    target: '[data-team-status]',
    position: 'bottom',
    action: 'none',
    order: 8
  },
  {
    id: 'complete',
    title: 'Tutorial Complete!',
    description: 'You\'re all set! You can always restart this tutorial from the settings page.',
    target: 'body',
    position: 'center',
    action: 'none',
    order: 9
  }
]

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [isTutorialActive, setIsTutorialActive] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [hasStartedTutorial, setHasStartedTutorial] = useState(false)
  const [steps] = useState(TUTORIAL_STEPS)
  const { isLoading } = useLoading()

  // Check if user is new and should see tutorial
  useEffect(() => {
    const checkTutorialStatus = () => {
      // Don't start tutorial while loading
      if (isLoading) return

      const currentUser = getCurrentUser()
      if (!currentUser) return

      // Check if user has completed tutorial before
      const hasCompletedTutorial = localStorage.getItem(`tutorial-completed-${currentUser.email}`)
      const isNewUser = localStorage.getItem(`is-new-user-${currentUser.email}`)
      
      // If this is a new user and they haven't completed the tutorial, start it
      if (isNewUser === 'true' && !hasCompletedTutorial && !hasStartedTutorial) {
        // Additional delay to ensure all components are fully rendered after loading screen
        setTimeout(() => {
          setHasStartedTutorial(true)
          startTutorial()
        }, 2000) // Wait 2 seconds after loading completes
      }
    }

    checkTutorialStatus()
  }, [isLoading, hasStartedTutorial]) // Add isLoading and hasStartedTutorial as dependencies

  const startTutorial = () => {
    setIsTutorialActive(true)
    setCurrentStep(0)
    setIsCompleted(false)
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      completeTutorial()
    }
  }

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const skipTutorial = () => {
    setIsTutorialActive(false)
    setCurrentStep(0)
    setIsCompleted(true)
    
    // Mark tutorial as completed for this user
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      localStorage.setItem(`tutorial-completed-${currentUser.email}`, 'true')
    }
  }

  const completeTutorial = () => {
    setIsTutorialActive(false)
    setCurrentStep(0)
    setIsCompleted(true)
    
    // Mark tutorial as completed for this user
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      localStorage.setItem(`tutorial-completed-${currentUser.email}`, 'true')
      localStorage.removeItem(`is-new-user-${currentUser.email}`)
    }
  }

  const resetTutorial = () => {
    const currentUser = getCurrentUser()
    if (currentUser?.email) {
      localStorage.removeItem(`tutorial-completed-${currentUser.email}`)
      localStorage.setItem(`is-new-user-${currentUser.email}`, 'true')
    }
    setIsCompleted(false)
    setCurrentStep(0)
    setHasStartedTutorial(false)
  }

  const value = {
    isTutorialActive,
    currentStep,
    steps,
    isCompleted,
    startTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    resetTutorial
  }

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  )
}

export function useTutorial() {
  const context = useContext(TutorialContext)
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider')
  }
  return context
}
