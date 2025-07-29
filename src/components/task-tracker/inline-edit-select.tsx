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
import { Plus, Check, Trash2 } from "lucide-react"

interface OptionData {
  id: number
  name: string
  color?: string
  is_default: boolean
}

interface InlineEditSelectProps {
  value: string
  options: string[] // Keep for backward compatibility
  optionsData?: OptionData[] // New prop with full option data
  onSave: (value: string) => void
  onAddOption?: (option: string) => void
  onDeleteOption?: (optionId: number, optionName: string) => void // New delete handler
  placeholder?: string
  variant?: "default" | "status" | "priority" | "taskType"
  className?: string
  colorMap?: Record<string, string> // New prop for database colors
  isLoading?: boolean // New prop to handle loading state
}

export function InlineEditSelect({
  value,
  options,
  optionsData = [],
  onSave,
  onAddOption,
  onDeleteOption,
  placeholder = "Select option",
  variant = "default",
  className = "",
  colorMap = {},
  isLoading = false
}: InlineEditSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newOption, setNewOption] = useState("")
  const [showAddInput, setShowAddInput] = useState(false)

  // Use optionsData if available, otherwise fall back to options array
  const displayOptions = optionsData.length > 0 ? optionsData.map(opt => opt.name) : options

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

  // Get color from database or fallback to default
  const getItemColor = (itemValue: string) => {
    // Try to get color from optionsData first
    const optionData = optionsData.find(opt => opt.name === itemValue)
    if (optionData?.color) {
      return optionData.color
    }
    // Fall back to colorMap
    return colorMap[itemValue] || '#6b7280'
  }

  // Check if we should use database colors (for status and taskType)
  // Only use custom colors if not loading and we have color data
  const shouldUseCustomColors = (variant === "status" || variant === "taskType") && !isLoading && (Object.keys(colorMap).length > 0 || optionsData.length > 0)

  const renderBadge = (itemValue: string) => {
    // Show loading state for status/taskType when colors are being fetched
    if ((variant === "status" || variant === "taskType") && isLoading) {
      return (
        <div className="h-6 w-16 bg-muted animate-pulse rounded-full"></div>
      )
    }

    if (shouldUseCustomColors) {
      const color = getItemColor(itemValue)
      return (
        <span 
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white whitespace-nowrap"
          style={{ backgroundColor: color }}
        >
          {itemValue}
        </span>
      )
    }
    
    return (
      <Badge variant={getBadgeVariant(itemValue, variant) as any} className="whitespace-nowrap">
        {itemValue}
      </Badge>
    )
  }

  const handleAddOption = () => {
    if (newOption.trim() && !displayOptions.includes(newOption.trim()) && onAddOption) {
      onAddOption(newOption.trim())
      onSave(newOption.trim())
      setNewOption("")
      setShowAddInput(false)
      setIsOpen(false)
    }
  }

  const handleDeleteOption = (optionId: number, optionName: string) => {
    if (onDeleteOption) {
      onDeleteOption(optionId, optionName)
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
            <div className="flex items-center min-w-0">
              {renderBadge(value)}
            </div>
          ) : (
            <span className="text-muted-foreground italic whitespace-nowrap">{placeholder}</span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          {displayOptions.map((option, index) => {
            const optionData = optionsData.find(opt => opt.name === option)
            const canDelete = optionData && !optionData.is_default && onDeleteOption
            // Create a truly unique key that handles undefined values
            const safeName = option || `unnamed-${index}`
            const uniqueKey = optionData?.id ? `${optionData.id}-${safeName}` : `fallback-${index}-${safeName}`
            
            return (
              <div
                key={uniqueKey}
                className="flex items-center justify-between p-2 hover:bg-muted rounded group"
              >
                <div 
                  onClick={() => handleSelect(option)}
                  className="flex items-center cursor-pointer flex-1"
                >
                  {renderBadge(option)}
                  {value === option && <Check className="h-4 w-4 ml-2" />}
                </div>
                
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteOption(optionData.id, option)
                    }}
                    className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            )
          })}
          
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