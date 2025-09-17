"use client"

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useTutorial, TutorialStep } from '@/contexts/tutorial-context'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TutorialOverlayProps {
  className?: string
}

export function TutorialOverlay({ className }: TutorialOverlayProps) {
  const {
    isTutorialActive,
    currentStep,
    steps,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial
  } = useTutorial()

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const currentStepData = steps[currentStep]

  const updateTooltipPosition = useCallback((element: HTMLElement) => {
    if (!tooltipRef.current) return

    const rect = element.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const padding = 16

    let top = 0
    let left = 0

    switch (currentStepData.position) {
      case 'top':
        top = rect.top - tooltipRect.height - padding
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2)
        break
      case 'bottom':
        top = rect.bottom + padding
        left = rect.left + (rect.width / 2) - (tooltipRect.width / 2)
        break
      case 'left':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2)
        left = rect.left - tooltipRect.width - padding
        break
      case 'right':
        top = rect.top + (rect.height / 2) - (tooltipRect.height / 2)
        left = rect.right + padding
        break
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2
        left = window.innerWidth / 2 - tooltipRect.width / 2
        break
    }

    // Ensure tooltip stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left < padding) left = padding
    if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding
    }
    if (top < padding) top = padding
    if (top + tooltipRect.height > viewportHeight - padding) {
      top = viewportHeight - tooltipRect.height - padding
    }

    setTooltipPosition({ top, left })
  }, [currentStepData])

  // Find and highlight the target element
  useEffect(() => {
    if (!isTutorialActive || !currentStepData) {
      setTargetElement(null)
      setIsVisible(false)
      return
    }

    const element = document.querySelector(currentStepData.target) as HTMLElement
    if (element && currentStepData.target !== 'body') {
      setTargetElement(element)
      setIsVisible(true)
      updateTooltipPosition(element)
    } else {
      // If target element not found or is 'body', show in center
      setTargetElement(null)
      setIsVisible(true)
      // Set initial center position - will be adjusted after render
      setTooltipPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2
      })
    }
  }, [isTutorialActive, currentStep, currentStepData, updateTooltipPosition])

  // Adjust position after tooltip is rendered for center positioning
  useEffect(() => {
    if (isVisible && currentStepData?.position === 'center' && !targetElement && tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: (window.innerHeight - tooltipRect.height) / 2,
        left: (window.innerWidth - tooltipRect.width) / 2
      })
    }
  }, [isVisible, currentStepData, targetElement])

  // Update tooltip position when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (targetElement) {
        updateTooltipPosition(targetElement)
      } else if (currentStepData?.position === 'center' && tooltipRef.current) {
        // Re-center the tooltip on window resize
        const tooltipRect = tooltipRef.current.getBoundingClientRect()
        setTooltipPosition({
          top: (window.innerHeight - tooltipRect.height) / 2,
          left: (window.innerWidth - tooltipRect.width) / 2
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [targetElement, currentStepData, updateTooltipPosition])


  const handleNext = () => {
    // Don't automatically click elements - let users interact with them manually
    // The action field is just for reference/display purposes
    nextStep()
  }

  const handlePrevious = () => {
    previousStep()
  }

  const handleSkip = () => {
    skipTutorial()
  }

  const handleComplete = () => {
    completeTutorial()
  }

  if (!isTutorialActive || !isVisible || !currentStepData) {
    return null
  }

  return (
    <>
      {/* Dark overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        style={{ zIndex: 9998 }}
      />

      {/* Highlighted element overlay */}
      {targetElement && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            top: targetElement.getBoundingClientRect().top - 4,
            left: targetElement.getBoundingClientRect().left - 4,
            width: targetElement.getBoundingClientRect().width + 8,
            height: targetElement.getBoundingClientRect().height + 8,
            border: '2px solid #3b82f6',
            borderRadius: '8px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
            zIndex: 9999
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={cn(
          "fixed z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 max-w-sm",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          className
        )}
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          zIndex: 10000
        }}
      >
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Step {currentStep + 1} of {steps.length}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {currentStepData.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
            {currentStepData.description}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                className="flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
            
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={handleComplete}
                className="flex items-center gap-1"
              >
                Complete
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                className="flex items-center gap-1"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
