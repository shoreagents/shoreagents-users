"use client"

import { useState, useEffect } from "react"
import { useProfileContext } from "@/contexts/profile-context"
import { useTimer } from "@/contexts/timer-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clock } from "lucide-react"
import { ConfirmationDialog } from "@/components/confirmation-dialog"

interface InactivityDialog60sProps {
  open: boolean
  onClose: () => void
  onReset: () => void
  onAutoLogout?: () => void
  inactiveTime: number
  threshold: number
  onPausedStateChange?: (isPaused: boolean) => void
}

// Dynamic questions for 60-second dialog
const dynamicQuestions60s = [
  "What are you working on?",
  "What task are you currently handling?",
  "What project are you focusing on?",
  "What are you doing right now?",
  "What work are you engaged in?"
]

export function InactivityDialog60s({
  open,
  onClose,
  onReset,
  onAutoLogout,
  inactiveTime,
  threshold,
  onPausedStateChange
}: InactivityDialog60sProps) {
  const { profile } = useProfileContext()
  const { lastActivityState } = useTimer()
  const [currentQuestion, setCurrentQuestion] = useState(dynamicQuestions60s[0])
  const [userResponse, setUserResponse] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  // Set random question when dialog opens
  useEffect(() => {
    if (open) {
      const randomIndex = Math.floor(Math.random() * dynamicQuestions60s.length)
      setCurrentQuestion(dynamicQuestions60s[randomIndex])
      setUserResponse("") // Clear previous response
    }
  }, [open])

  // Monitor activity state and pause dialog when user becomes active
  useEffect(() => {
    if (open && lastActivityState === true) {
      // User is active - pause the dialog
      if (!isPaused) {
        setIsPaused(true)
        if (onPausedStateChange) {
          onPausedStateChange(true)
        }
      }
    } else if (open && lastActivityState === false) {
      // User is inactive - resume the dialog
      if (isPaused) {
        setIsPaused(false)
        if (onPausedStateChange) {
          onPausedStateChange(false)
        }
      }
    }
  }, [open, lastActivityState, isPaused, onPausedStateChange])

  const handleSubmit = () => {
    if (userResponse.trim()) {
      setIsSubmitting(true)
      // Here you could save the response to a database or log it
      console.log('User response:', userResponse)
      
      // Show confirmation dialog instead of immediately closing
      setTimeout(() => {
        setShowConfirmation(true)
        setIsSubmitting(false)
      }, 500) // Small delay for better UX
    }
  }

  const handleConfirmationClose = () => {
    setShowConfirmation(false)
    onClose()
    onReset()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userResponse.trim()) {
      handleSubmit()
    }
  }

  // Get user's first name or fallback to "there"
  const userName = profile?.first_name || profile?.nickname || "there"

  return (
    <>
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              I see that you've been inactive, {userName}
            </DialogTitle>
            <DialogDescription>
              {currentQuestion}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="user-response" className="text-sm font-medium">
                Please let us know what you're working on:
              </label>
              <Input
                id="user-response"
                type="text"
                placeholder="Type your response here..."
                value={userResponse}
                onChange={(e) => setUserResponse(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSubmitting}
                className="w-full"
                autoFocus
              />
            </div>
            
            <div className="flex justify-end">
              <Button 
                onClick={handleSubmit}
                disabled={!userResponse.trim() || isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? "Submitting..." : "Continue"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog 
        open={showConfirmation} 
        onClose={handleConfirmationClose} 
      />
    </>
  )
}
