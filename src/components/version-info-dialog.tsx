"use client"

import { useState } from "react"
import { Info } from "lucide-react"
import Image from "next/image"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface VersionInfoDialogProps {
  children: React.ReactNode
}

export function VersionInfoDialog({ children }: VersionInfoDialogProps) {
  const [open, setOpen] = useState(false)

  // Get version from package.json
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            App Version
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="relative h-16 w-16">
              <Image
                src="/ShoreAgents-Logo-only-256.png"
                alt="ShoreAgents Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="text-center">
              <h3 className="font-medium">ShoreAgents Dashboard</h3>
              <p className="text-sm text-muted-foreground tracking-widest">v{appVersion}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}