"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Paperclip, X, Upload } from "lucide-react"

interface InlineEditFilesProps {
  value: string[]
  onSave: (value: string[]) => void
  className?: string
}

export function InlineEditFiles({
  value,
  onSave,
  className = ""
}: InlineEditFilesProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map(file => file.name)
      onSave([...value, ...newFiles])
    }
  }

  const removeFile = (index: number) => {
    const newFiles = value.filter((_, i) => i !== index)
    onSave(newFiles)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={`cursor-pointer hover:bg-muted/50 rounded px-2 py-1 min-h-[2rem] flex items-center gap-2 ${className}`}>
          <Paperclip className="h-3 w-3 text-muted-foreground" />
          {value.length > 0 ? (
            <Badge variant="outline">{value.length} file{value.length !== 1 ? 's' : ''}</Badge>
          ) : (
            <span className="text-muted-foreground italic text-sm">Attach files</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">Attached Files</span>
            <label htmlFor="file-upload" className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Add Files
                </span>
              </Button>
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.pptx"
              />
            </label>
          </div>
          
          {value.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Paperclip className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No files attached</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {value.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{file}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
} 