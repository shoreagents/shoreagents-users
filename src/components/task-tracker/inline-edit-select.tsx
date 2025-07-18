"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Plus, Check } from "lucide-react"

interface InlineEditSelectProps {
  value: string
  options: string[]
  onSave: (value: string) => void
  onAddOption?: (option: string) => void
  placeholder?: string
  variant?: "default" | "status" | "priority" | "taskType"
  className?: string
}

export function InlineEditSelect({
  value,
  options,
  onSave,
  onAddOption,
  placeholder = "Select option",
  variant = "default",
  className = ""
}: InlineEditSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newOption, setNewOption] = useState("")
  const [showAddInput, setShowAddInput] = useState(false)

  const getBadgeVariant = (val: string, var_type: string) => {
    if (var_type === "status") {
      switch (val.toLowerCase()) {
        case "done": return "default"
        case "in progress": return "secondary"
        case "not started": return "outline"
        default: return "outline"
      }
    }
    if (var_type === "priority") {
      switch (val.toLowerCase()) {
        case "high": return "destructive"
        case "medium": return "secondary"
        case "low": return "outline"
        default: return "outline"
      }
    }
    return "outline"
  }

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim()) && onAddOption) {
      onAddOption(newOption.trim())
      onSave(newOption.trim())
      setNewOption("")
      setShowAddInput(false)
      setIsOpen(false)
    }
  }

  const handleSelect = (selectedValue: string) => {
    onSave(selectedValue)
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={`cursor-pointer hover:bg-muted/50 rounded px-2 py-1 min-h-[2rem] flex items-center ${className}`}>
          {value ? (
            <Badge variant={getBadgeVariant(value, variant) as any}>
              {value}
            </Badge>
          ) : (
            <span className="text-muted-foreground italic">{placeholder}</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          {options.map((option) => (
            <div
              key={option}
              onClick={() => handleSelect(option)}
              className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
            >
              <Badge variant={getBadgeVariant(option, variant) as any}>
                {option}
              </Badge>
              {value === option && <Check className="h-4 w-4" />}
            </div>
          ))}
          
          {onAddOption && (
            <>
              <div className="border-t pt-2">
                {!showAddInput ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddInput(true)}
                    className="w-full justify-start"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add new option
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      placeholder="New option"
                      className="h-8"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddOption()
                        } else if (e.key === 'Escape') {
                          setShowAddInput(false)
                          setNewOption("")
                        }
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={handleAddOption} disabled={!newOption.trim()}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
} 