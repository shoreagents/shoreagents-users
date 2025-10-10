"use client"

import { useState, useEffect, useRef } from "react"
import { useProfileContext } from "@/contexts/profile-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"
import Lottie from "lottie-react"
import starStrikeAnimation from "../../public/Star Strike Emoji.json"

interface ConfirmationDialogProps {
  open: boolean
  onClose: () => void
}

// Dynamic confirmation messages
const confirmationMessages = [
  "Ok, hope you'll have a great time with your work!",
  "Great! Wishing you a productive session ahead!",
  "Awesome! Hope you have a wonderful work experience!",
  "Perfect! May you have an amazing time working!",
  "Excellent! Wishing you a fantastic work session!",
  "Wonderful! Hope you have a great time with your tasks!",
  "Fantastic! May your work session be productive and enjoyable!",
  "Brilliant! Wishing you a successful and fulfilling work time!",
  "Outstanding! Hope you have an incredible work experience!",
  "Superb! May your work session be both productive and rewarding!"
]

export function ConfirmationDialog({
  open,
  onClose
}: ConfirmationDialogProps) {
  const { profile } = useProfileContext()
  const [currentMessage, setCurrentMessage] = useState(confirmationMessages[0])
  const [showAnimation, setShowAnimation] = useState(false)
  const lottieRef = useRef<any>(null)

  // Set random message when dialog opens
  useEffect(() => {
    if (open) {
      const randomIndex = Math.floor(Math.random() * confirmationMessages.length)
      setCurrentMessage(confirmationMessages[randomIndex])
      setShowAnimation(true)
      
      // Play the Lottie animation
      if (lottieRef.current) {
        lottieRef.current.play()
      }
    }
  }, [open])

  const handleClose = () => {
    setShowAnimation(false)
    setTimeout(() => {
      onClose()
    }, 200) // Small delay for animation
  }

  // Get user's first name or fallback to "there"
  const userName = profile?.first_name || profile?.nickname || "there"

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-center justify-center">
            <CheckCircle className="h-6 w-6 text-green-500" />
            <span className="text-green-600">Thank you, {userName}!</span>
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            {currentMessage}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className={`transition-all duration-500 ${showAnimation ? 'scale-110 opacity-100' : 'scale-100 opacity-0'}`}>
              <Lottie
                lottieRef={lottieRef}
                animationData={starStrikeAnimation}
                style={{ width: 120, height: 120 }}
                loop={false}
                autoplay={true}
              />
            </div>
          </div>
          
          <div className="flex justify-center">
            <Button 
              onClick={handleClose} 
              className="bg-green-600 hover:bg-green-700 px-8"
            >
              Continue Working
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
