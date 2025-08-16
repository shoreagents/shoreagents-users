"use client"

import React from 'react'
import { useTimer } from '@/contexts/timer-context'
import { Clock, Calendar, Zap } from 'lucide-react'

export function ShiftResetTimer() {
  const { shiftInfo, timeUntilReset, formattedTimeUntilReset } = useTimer()

  if (!shiftInfo) {
    return null
  }

  const isResetSoon = timeUntilReset <= 300000 // 5 minutes or less

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
      isResetSoon 
        ? 'bg-orange-50 border-orange-200 text-orange-700' 
        : 'bg-blue-50 border-blue-200 text-blue-700'
    }`}>
      <Clock className="w-4 h-4" />
      <div className="flex flex-col">
        <div className="text-sm font-medium">
          {shiftInfo.period} - {shiftInfo.time}
        </div>
        <div className="text-xs">
          Next reset in: <span className="font-mono font-bold">{formattedTimeUntilReset}</span>
        </div>
      </div>
      {isResetSoon && (
        <Zap className="w-4 h-4 animate-pulse" />
      )}
    </div>
  )
}
