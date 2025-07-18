"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface InlineEditDateProps {
  value: string
  onSave: (value: string) => void
  placeholder?: string
  className?: string
}

export function InlineEditDate({
  value,
  onSave,
  placeholder = "Set due date",
  className = ""
}: InlineEditDateProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedDate = value ? new Date(value) : undefined

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onSave(format(date, "yyyy-MM-dd"))
    } else {
      onSave("")
    }
    setIsOpen(false)
  }

  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return null
    try {
      return format(new Date(dateString), "MMM dd, yyyy")
    } catch {
      return dateString
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn(
          "cursor-pointer hover:bg-muted/50 rounded px-2 py-1 min-h-[2rem] flex items-center gap-2",
          className
        )}>
          <CalendarIcon className="h-3 w-3 text-muted-foreground" />
          {value ? (
            <span className="text-sm">{formatDisplayDate(value)}</span>
          ) : (
            <span className="text-muted-foreground italic text-sm">{placeholder}</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
        {value && (
          <div className="p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelect(undefined)}
              className="w-full"
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
} 