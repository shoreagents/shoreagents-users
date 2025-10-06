"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useTimer } from "@/contexts/timer-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Clock, MousePointer } from "lucide-react"

interface InactivityDialogProps {
  open: boolean
  onClose: () => void
  onReset: () => void
  onAutoLogout?: () => void
  inactiveTime: number
  threshold: number
}

export function InactivityDialog({
  open,
  onClose,
  onReset,
  onAutoLogout,
  inactiveTime,
  threshold
}: InactivityDialogProps) {
  const { liveInactiveSeconds } = useTimer()
  const [dialogElapsedTime, setDialogElapsedTime] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)

  // Track how long the dialog has been open (starts from threshold time)
  useEffect(() => {
    if (!open) {
      setDialogElapsedTime(0)
      setStartTime(null)
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
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        // Add threshold time to get total time since inactivity started
        const totalTime = Math.floor(threshold / 1000) + elapsed
        setDialogElapsedTime(totalTime)
      }
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [open, startTime, threshold])

  const handleClose = () => {
    // Simply close the dialog - activity will naturally resume when user becomes active
    // Removed setTimeout delay for immediate response
    onClose()
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-500" />
            Inactivity Detected
          </DialogTitle>
          <DialogDescription>
            We haven't detected any mouse movement for {formatInactiveTime(dialogElapsedTime * 1000)}. 
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Inactive time:</span>
              <span className="font-medium">{formatTime(liveInactiveSeconds)}</span>
            </div>
            <Progress value={((liveInactiveSeconds % 60) / 60) * 100} className="w-full" />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MousePointer className="h-4 w-4" />
            <span>Move your mouse to naturally resume activity tracking</span>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button onClick={handleClose}>
            I'm Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 



