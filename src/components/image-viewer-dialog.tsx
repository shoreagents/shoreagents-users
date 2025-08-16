"use client"

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { useState, useRef, useEffect } from 'react'

interface ImageViewerDialogProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  fileName: string
}

export function ImageViewerDialog({ isOpen, onClose, imageUrl, fileName }: ImageViewerDialogProps) {
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const imageRef = useRef<HTMLImageElement>(null)

  // Reset transformations when dialog opens
  useEffect(() => {
    if (isOpen) {
      setScale(1)
      setRotation(0)
      setPosition({ x: 0, y: 0 })
    }
  }, [isOpen])

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.2, 5))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.2, 0.1))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleReset = () => {
    setScale(1)
    setRotation(0)
    setPosition({ x: 0, y: 0 })
  }



  const handleMouseDown = (e: React.MouseEvent) => {
    // Allow dragging when zoomed in (scale > 1) OR when zoomed out (scale < 1)
    if (scale !== 1) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale !== 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY < 0) {
      handleZoomIn()
    } else {
      handleZoomOut()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[80vw] max-h-[80vh] p-0 overflow-hidden">
        <DialogHeader className="p-3 pb-2 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold truncate max-w-md">
              {fileName}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Image Controls */}
        <div className="flex items-center justify-center gap-1 p-2 border-b bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={scale <= 0.1}
            className="h-7 px-2 text-xs"
          >
            <ZoomOut className="h-3 w-3 mr-1" />
            Zoom Out
          </Button>
          
          <span className="text-xs text-muted-foreground min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={scale >= 5}
            className="h-7 px-2 text-xs"
          >
            <ZoomIn className="h-3 w-3 mr-1" />
            Zoom In
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            className="h-7 px-2 text-xs"
          >
            <RotateCw className="h-3 w-3 mr-1" />
            Rotate
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-xs"
          >
            Reset
          </Button>
          

        </div>

        {/* Image Container */}
        <div 
          className="flex-1 overflow-hidden bg-black/90 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{ cursor: isDragging ? 'grabbing' : scale !== 1 ? 'grab' : 'default' }}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt={fileName}
            className="max-w-none select-none"
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
