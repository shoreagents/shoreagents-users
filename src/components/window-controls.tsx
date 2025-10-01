"use client"

import React, { useEffect } from "react"
import { Minus, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function WindowControls() {
  const handleMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize()
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize()
    }
  }

  const handleClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close()
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F11') {
        event.preventDefault()
        handleMaximize()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div className="flex items-center gap-4 ml-4">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white "
        onClick={handleMinimize}
        aria-label="Minimize"
        title="Minimize"
      >
        <Minus className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-none transition-colors text-gray-500 hover:text-gray-900 dark:hover:text-white "
        onClick={handleMaximize}
        aria-label="Maximize"
        title="Maximize"
      >
        <Square className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:!bg-red-500 rounded-none transition-colors text-gray-500 hover:text-white "
        onClick={handleClose}
        aria-label="Close"
        title="Close"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  )
}
