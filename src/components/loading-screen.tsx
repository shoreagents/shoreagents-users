'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LoadingScreenProps {
  onComplete?: () => void
  duration?: number
  className?: string
}

export function LoadingScreen({ onComplete, duration = 2000, className }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)
  const [progress, setProgress] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  // Preload the logo image
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const img = new window.Image()
      img.onload = () => {
        setImageLoaded(true)
      }
      img.onerror = () => {
        setImageError(true)
      }
      img.src = '/shoreagents-logo.png'
    }
  }, [])

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval)
          return 100
        }
        return prev + 2
      })
    }, duration / 50) // 50 steps over the duration

    // Hide loading screen after duration
    const timer = setTimeout(() => {
      setIsVisible(false)
      onComplete?.()
    }, duration)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(timer)
    }
  }, [duration, onComplete])

  if (!isVisible) return null

  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-background flex flex-col items-center justify-center",
      "animate-in fade-in duration-500",
      className
    )}>
      {/* Logo */}
      <div className="relative mb-8">
            <Image
              src="/shoreagents-logo.png"
              alt="ShoreAgents"
              width={120}
              height={120}
              className="object-contain"
              style={{ width: 'auto', height: 'auto' }}
              priority
              unoptimized
              onError={() => setImageError(true)}
              onLoad={() => setImageLoaded(true)}
            />
      </div>

      <p className="text-muted-foreground mb-8 animate-in slide-in-from-bottom-4 duration-700 delay-500">
        Staff Management System
      </p>

      {/* Progress Bar */}
      <div className="w-64 h-2 bg-muted rounded-full overflow-hidden animate-in slide-in-from-bottom-4 duration-700 delay-700">
        <div 
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Loading Text */}
      <p className="text-sm text-muted-foreground mt-4 animate-in slide-in-from-bottom-4 duration-700 delay-900">
        Loading your workspace...
      </p>

      {/* Animated Dots */}
      <div className="flex space-x-1 mt-4 animate-in slide-in-from-bottom-4 duration-700 delay-1100">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// Hook to manage loading state
export function useLoadingScreen() {
  const [isLoading, setIsLoading] = useState(true)

  const completeLoading = () => {
    setIsLoading(false)
  }

  return {
    isLoading,
    completeLoading
  }
}
