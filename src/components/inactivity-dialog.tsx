"use client"

import { useState, useEffect, useRef } from "react"
import { useTimer } from "@/contexts/timer-context"
import { useProfileContext } from "@/contexts/profile-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Clock, MousePointer } from "lucide-react"
import Lottie from "lottie-react"
import thinkingAnimation from "../../public/Thinking.json"

interface InactivityDialogProps {
  open: boolean
  onClose: () => void
  onReset: () => void
  onAutoLogout?: () => void
  inactiveTime: number
  threshold: number
  onPausedStateChange?: (isPaused: boolean) => void
  onShow60sDialog?: () => void
}

// Dynamic questions array
const dynamicQuestions = [
  "Are you still working?",
  "Are you taking a break?",
  "Are you still active?",
  "Are you working on something?",
  "Are you still here?"
]

// Dynamic button responses
const buttonResponses = [
  "Yes, I just overlooked it",
  "Yes, I'm still working",
  "Yes, I'm active",
  "Yes, I'm here",
  "Yes, I'm working"
]

export function InactivityDialog({
  open,
  onClose,
  onReset,
  onAutoLogout,
  inactiveTime,
  threshold,
  onPausedStateChange,
  onShow60sDialog
}: InactivityDialogProps) {
  const { liveInactiveSeconds, lastActivityState } = useTimer()
  const { profile } = useProfileContext()
  const [dialogElapsedTime, setDialogElapsedTime] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const lottieRef = useRef<any>(null)
  
  // Get random question and response
  const [currentQuestion, setCurrentQuestion] = useState(dynamicQuestions[0])
  const [currentResponse, setCurrentResponse] = useState(buttonResponses[0])

  // Set random question and response when dialog opens
  useEffect(() => {
    if (open) {
      const randomIndex = Math.floor(Math.random() * dynamicQuestions.length)
      setCurrentQuestion(dynamicQuestions[randomIndex])
      setCurrentResponse(buttonResponses[randomIndex])
      
      // Play the Lottie animation
      if (lottieRef.current) {
        lottieRef.current.play()
      }
    }
  }, [open])

  // Notify parent when paused state changes
  useEffect(() => {
    if (onPausedStateChange) {
      onPausedStateChange(isPaused)
    }
  }, [isPaused, onPausedStateChange])

  // Track how long the dialog has been open (starts from threshold time)
  useEffect(() => {
    if (!open) {
      setDialogElapsedTime(0)
      setStartTime(null)
      setIsPaused(false)
      return
    }

    // Set start time when dialog opens
    if (startTime === null) {
      const now = Date.now();
      setStartTime(now)
      // Start with the threshold time (30 seconds)
      setDialogElapsedTime(Math.floor(threshold / 1000))
    }

    const interval = setInterval(() => {
      if (startTime) {
        // Check if user is active - if so, pause the timer
        if (lastActivityState === true) {
          if (!isPaused) {
            setIsPaused(true)
          }
          return // Don't increment timer when user is active
        } else {
          // User is inactive, resume timer if it was paused
          if (isPaused) {
            setIsPaused(false)
            // Reset start time to current time to avoid jumping
            setStartTime(Date.now())
            setDialogElapsedTime(Math.floor(threshold / 1000))
            return
          }
        }
        
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        // Add threshold time to get total time since inactivity started
        const totalTime = Math.floor(threshold / 1000) + elapsed
        setDialogElapsedTime(totalTime)
        
        // Check if we've reached 60 seconds and trigger the 60s dialog
        if (totalTime >= 60 && onShow60sDialog) {
          onShow60sDialog()
        }
      }
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [open, startTime, threshold, lastActivityState, isPaused, onShow60sDialog])

  const handleClose = () => {
    // Close the dialog and reset activity when user manually confirms
    onClose()
    onReset() // This will properly clear the inactivity data
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
  }

  const formatInactiveTime = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 60000)
    const seconds = Math.floor((milliseconds % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  // Get user's first name or fallback to "there"
  const userName = profile?.first_name || profile?.nickname || "there"

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Hey {userName}, {currentQuestion}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
          <div className="flex justify-center">
              <Lottie
                lottieRef={lottieRef}
                animationData={thinkingAnimation}
                style={{ width: 120, height: 120 }}
                loop={true}
                autoplay={true}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span>You've been inactive for</span>
              <span className="font-medium">
                {formatTime(dialogElapsedTime)}
                {isPaused && <span className="text-green-600 ml-2">(Paused)</span>}
              </span>
            </div>
            
            <Progress 
              value={isPaused ? 0 : ((dialogElapsedTime % 60) / 60) * 100} 
              className={`w-full ${isPaused ? 'opacity-50' : ''}`} 
            />
          </div>
          
          <div className="flex justify-end">
            <Button onClick={handleClose} className="bg-green-600 hover:bg-green-700">
              {currentResponse}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 



