"use client"

import React from 'react'
import { useEventsContext } from '@/contexts/events-context'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlobalLoadingIndicatorProps {
  className?: string
  customLoading?: boolean
  customLoadingText?: string
}

export const GlobalLoadingIndicator = React.memo(function GlobalLoadingIndicator({ 
  className, 
  customLoading = false, 
  customLoadingText 
}: GlobalLoadingIndicatorProps) {
  const { isJoiningEvent, isLeavingEvent } = useEventsContext()
  
  const isLoading = isJoiningEvent || isLeavingEvent || customLoading
  
  if (!isLoading) {
    return null
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50 backdrop-blur-lg flex items-center justify-center",
      className
    )}>
      <div className="flex items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="text-lg font-medium text-white">
          {customLoadingText || (isJoiningEvent ? 'Joining event...' : isLeavingEvent ? 'Leaving event...' : '')}
        </span>
      </div>
    </div>
  )
})
