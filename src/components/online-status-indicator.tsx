"use client"

import React from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface OnlineStatusIndicatorProps {
  status: 'online' | 'offline' | 'away' | 'connecting'
  size?: 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  className?: string
}

export function OnlineStatusIndicator({ 
  status, 
  size = 'md', 
  showTooltip = true,
  className 
}: OnlineStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  }

  const statusConfig = {
    online: {
      color: 'bg-green-500',
      animation: 'animate-pulse',
      tooltip: 'Online'
    },
    connecting: {
      color: 'bg-blue-500',
      animation: 'animate-pulse',
      tooltip: 'Connecting...'
    },
    away: {
      color: 'bg-yellow-500',
      animation: 'animate-pulse',
      tooltip: 'Away'
    },
    offline: {
      color: 'bg-gray-400',
      animation: '',
      tooltip: 'Offline'
    }
  }

  const config = statusConfig[status]
  const indicator = (
    <div 
      className={cn(
        'rounded-full',
        config.color,
        config.animation,
        sizeClasses[size],
        className
      )}
    />
  )

  if (!showTooltip) {
    return indicator
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for leaderboard
export function LeaderboardStatusIndicator({ 
  status, 
  isInBreak 
}: { 
  status: 'online' | 'offline' | 'away' | 'connecting'
  isInBreak: boolean 
}) {
  // If user is in break, show yellow (away) status
  if (isInBreak) {
    return (
      <div className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" />
    )
  }

  // Otherwise show actual online status
  return <OnlineStatusIndicator status={status} size="sm" showTooltip={false} />
}
