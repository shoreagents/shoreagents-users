"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Calendar24Props {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  time?: string
  onTimeChange?: (time: string) => void
  minDate?: Date
}

export function Calendar24({ 
  date: externalDate, 
  onDateChange, 
  time: externalTime, 
  onTimeChange,
  minDate 
}: Calendar24Props) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(externalDate)
  const [time, setTime] = React.useState<string>(externalTime || "10:30:00")

  // Update internal state when external props change
  React.useEffect(() => {
    if (externalDate !== undefined) {
      setDate(externalDate)
    }
  }, [externalDate])

  React.useEffect(() => {
    if (externalTime !== undefined) {
      setTime(externalTime)
    }
  }, [externalTime])

  return (
    <div className="flex gap-4">
      <div className="flex flex-col gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              id="date-picker"
              className="w-32 justify-between font-normal"
            >
              {date ? date.toLocaleDateString() : "Select date"}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(selectedDate) => {
                setDate(selectedDate)
                onDateChange?.(selectedDate)
                setOpen(false)
              }}
              disabled={(date) => {
                if (!minDate) return false
                // Only disable dates that are before today (not including today)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return date < today
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-3">
        <Input
          type="time"
          id="time-picker"
          step="1"
          value={time}
          onChange={(e) => {
            setTime(e.target.value)
            onTimeChange?.(e.target.value)
          }}
          onWheel={(e) => {
            e.preventDefault()
            const input = e.target as HTMLInputElement
            const currentTime = input.value
            const [hours, minutes, seconds] = currentTime.split(':').map(Number)
            
            // Determine which part of the time is focused/selected
            const selectionStart = input.selectionStart || 0
            const selectionEnd = input.selectionEnd || 0
            
            let newTime = currentTime
            
            if (selectionStart >= 0 && selectionStart <= 2) {
              // Hours are selected
              const delta = e.deltaY > 0 ? -1 : 1
              const newHours = Math.max(0, Math.min(23, hours + delta))
              newTime = `${newHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            } else if (selectionStart >= 3 && selectionStart <= 5) {
              // Minutes are selected
              const delta = e.deltaY > 0 ? -1 : 1
              const newMinutes = Math.max(0, Math.min(59, minutes + delta))
              newTime = `${hours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            } else if (selectionStart >= 6 && selectionStart <= 8) {
              // Seconds are selected
              const delta = e.deltaY > 0 ? -1 : 1
              const newSeconds = Math.max(0, Math.min(59, seconds + delta))
              newTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')}`
            }
            
            setTime(newTime)
            onTimeChange?.(newTime)
          }}
          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  )
}
