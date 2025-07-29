"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Calendar as CalendarIcon,
  Clock,
  Flag,
  MoreHorizontal,
  Plus,
  Tag,
  Upload,
  User,
  Users,
  Zap,
  MessageSquare,
  Search,
  Bell,
  Settings,
  ChevronDown,
  Link,
  Paperclip,
  Check,
  ChevronRight
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import React from "react"
import { Card } from "@/components/ui/card"

interface Task {
  id: string
  title: string
  description: string
  priority: "urgent" | "high" | "normal" | "low"
  assignee: string
  dueDate: string
  tags: string[]
  status: string
  relationships?: Array<{ taskId: string; type: string }>
}

interface Column {
  id: string
  title: string
  color: string
}

interface TaskDetailDialogProps {
  task: Task | null
  tasks: Task[]
  columns: Column[]
  isOpen: boolean
  onClose: () => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
}

export function TaskDetailDialog({ task, tasks, columns, isOpen, onClose, onTaskUpdate }: TaskDetailDialogProps) {
  const [activeTab, setActiveTab] = useState("details")
  const [comment, setComment] = useState("")
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const [statusSearch, setStatusSearch] = useState("")
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState("")
  const [isStartDateOpen, setIsStartDateOpen] = useState(false)
  const [selectedStartDate, setSelectedStartDate] = useState<Date | undefined>(undefined)
  const [startTime, setStartTime] = useState("")
  const [showTimeInput, setShowTimeInput] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  const [selectedDueDate, setSelectedDueDate] = useState<Date | undefined>(undefined)
  const [dueTime, setDueTime] = useState("")
  const [datePickerMode, setDatePickerMode] = useState<"start" | "due">("start")
  const [showDueTimeInput, setShowDueTimeInput] = useState(false)
  const [isPriorityOpen, setIsPriorityOpen] = useState(false)
  const [newTag, setNewTag] = useState("")
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [isRelationshipsOpen, setIsRelationshipsOpen] = useState(false)
  const [relationshipSearch, setRelationshipSearch] = useState("")
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editedDescription, setEditedDescription] = useState("")
  const [customFields, setCustomFields] = useState<Array<{id: string, title: string, description: string}>>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<Array<{id: string, name: string, size: number}>>([])
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false)

  // Priority options with colors
  const priorityOptions = [
    { value: "urgent", label: "Urgent", color: "text-pink-500", bgColor: "bg-pink-500" },
    { value: "high", label: "High", color: "text-yellow-500", bgColor: "bg-yellow-500" },
    { value: "normal", label: "Normal", color: "text-blue-500", bgColor: "bg-blue-500" },
    { value: "low", label: "Low", color: "text-gray-500", bgColor: "bg-gray-500" }
  ]

  const priorityColors = {
    urgent: "text-pink-500",
    high: "text-yellow-500", 
    normal: "text-blue-500",
    low: "text-gray-500"
  }

  // Mock data for assignees dropdown
  const currentAssignees = [
    { id: "current-1", name: "Bob Smith", email: "bob@example.com", avatar: "" },
  ]

  const peopleList = [
    { id: "people-1", name: "Me", email: "me@example.com", avatar: "", isCurrentUser: true },
    { id: "people-2", name: "Kath Macenas", email: "kath@example.com", avatar: "", verified: true },
    { id: "people-3", name: "Kevin Macabanti", email: "kevin@example.com", avatar: "", verified: true },
    { id: "people-4", name: "Charmine Salas", email: "charmine@example.com", avatar: "" },
    { id: "people-5", name: "Mark Nobleza", email: "mark@example.com", avatar: "", verified: true },
    { id: "people-6", name: "Jose Recede", email: "jose@example.com", avatar: "" },
    { id: "people-7", name: "Stephen Atcheler", email: "stephen@example.com", avatar: "", verified: true },
  ]

  const teamList = [
    { id: "team-1", name: "Development Team", members: 8, avatar: "" },
    { id: "team-2", name: "Design Team", members: 4, avatar: "" },
    { id: "team-3", name: "QA Team", members: 6, avatar: "" },
  ]

  // Convert columns to status options with default colors
  const statusOptions = columns && columns.length > 0 ? columns.map(column => ({
    id: column.id,
    label: column.title,
    color: getStatusColor(column.id)
  })) : []

  // Function to get appropriate status colors
  function getStatusColor(statusId: string) {
    const colorMap: { [key: string]: string } = {
      'todo': 'bg-gray-500',
      'in-progress': 'bg-blue-500',
      'review': 'bg-yellow-500',
      'done': 'bg-green-500',
      'on-hold': 'bg-red-500',
      'blocked': 'bg-purple-500',
      'testing': 'bg-orange-500',
      'deployed': 'bg-indigo-500'
    }
    return colorMap[statusId] || 'bg-slate-500' // Default color for custom statuses
  }

  const currentStatus = statusOptions.find(s => s.id === task?.status) || statusOptions[0] || { id: task?.status || '', label: task?.status || '', color: 'bg-gray-500' }
  const filteredStatuses = statusOptions.filter(status => 
    status.label.toLowerCase().includes(statusSearch.toLowerCase())
  )

  // Initialize time from existing task start date
  React.useEffect(() => {
    if (task && (task as any).startDate) {
      const startDate = new Date((task as any).startDate)
      setSelectedStartDate(startDate)
      
      // Extract time if it's not midnight
      const hours = startDate.getHours()
      const minutes = startDate.getMinutes()
      if (hours !== 0 || minutes !== 0) {
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        setStartTime(timeString)
        setShowTimeInput(true)
      }
    }
  }, [task])

  // Initialize edited title when task changes
  React.useEffect(() => {
    if (task) {
      setEditedTitle(task.title)
    }
  }, [task])

  // Initialize due date from task data
  React.useEffect(() => {
    if (task && task.dueDate) {
      const dueDate = new Date(task.dueDate)
      setSelectedDueDate(dueDate)
      
      // Extract time if it's not midnight
      const hours = dueDate.getHours()
      const minutes = dueDate.getMinutes()
      if (hours !== 0 || minutes !== 0) {
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        setDueTime(timeString)
        setShowDueTimeInput(true)
      }
    }
  }, [task])

  if (!task) return null

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const handleStatusChange = (newStatus: string) => {
    onTaskUpdate(task.id, { status: newStatus })
    setIsStatusOpen(false)
  }

  const handlePriorityChange = (newPriority: "urgent" | "high" | "normal" | "low") => {
    onTaskUpdate(task.id, { priority: newPriority })
  }

  const handleAddTag = () => {
    const trimmedTag = newTag.trim()
    if (trimmedTag && !task.tags.includes(trimmedTag)) {
      const updatedTags = [...task.tags, trimmedTag]
      onTaskUpdate(task.id, { tags: updatedTags })
      setNewTag("")
      setIsAddingTag(false)
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = task.tags.filter(tag => tag !== tagToRemove)
    onTaskUpdate(task.id, { tags: updatedTags })
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setNewTag("")
      setIsAddingTag(false)
    }
  }

  const handleAddRelationship = (relatedTaskId: string, relationshipType: string) => {
    const newRelationship = { taskId: relatedTaskId, type: relationshipType }
    const updatedRelationships = [...(task.relationships || []), newRelationship]
    onTaskUpdate(task.id, { relationships: updatedRelationships } as any)
    setIsRelationshipsOpen(false)
  }

  const handleRemoveRelationship = (relationshipToRemove: any) => {
    const updatedRelationships = (task.relationships || []).filter(
      rel => !(rel.taskId === relationshipToRemove.taskId && rel.type === relationshipToRemove.type)
    )
    onTaskUpdate(task.id, { relationships: updatedRelationships } as any)
  }

  const handleDescriptionEdit = () => {
    setEditedDescription(task.description || "")
    setIsEditingDescription(true)
  }

  const handleDescriptionSave = () => {
    if (editedDescription !== task.description) {
      onTaskUpdate(task.id, { description: editedDescription })
    }
    setIsEditingDescription(false)
  }

  const handleDescriptionCancel = () => {
    setEditedDescription(task.description || "")
    setIsEditingDescription(false)
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      handleDescriptionSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleDescriptionCancel()
    }
  }

  const addCustomField = () => {
    const newField = {
      id: `field-${Date.now()}`,
      title: "",
      description: ""
    }
    setCustomFields(prev => [...prev, newField])
  }

  const updateCustomField = (fieldId: string, updates: Partial<{title: string, description: string}>) => {
    setCustomFields(prev => 
      prev.map(field => 
        field.id === fieldId ? { ...field, ...updates } : field
      )
    )
  }

  const removeCustomField = (fieldId: string) => {
    setCustomFields(prev => prev.filter(field => field.id !== fieldId))
  }

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const allowedTypes = [
      'image/', 'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
    ]
    
    const validFiles = files.filter(file => {
      return allowedTypes.some(type => file.type.startsWith(type))
    })
    
    const newFiles = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size
    }))
    
    setUploadedFiles(prev => [...prev, ...newFiles])
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const allowedTypes = [
      'image/', 'application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
    ]
    
    const validFiles = files.filter(file => {
      return allowedTypes.some(type => file.type.startsWith(type))
    })
    
    const newFiles = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size
    }))
    
    setUploadedFiles(prev => [...prev, ...newFiles])
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  const handleAssigneeChange = (newAssignee: string) => {
    onTaskUpdate(task.id, { assignee: newAssignee })
    setIsAssigneeOpen(false)
  }

  // Helper functions for quick date selections
  const getQuickDate = (type: string): Date => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    switch (type) {
      case 'today':
        return today
      case 'tomorrow':
        return tomorrow
      case 'this-weekend':
        const thisWeekend = new Date(today)
        const daysUntilSaturday = 6 - today.getDay()
        thisWeekend.setDate(today.getDate() + daysUntilSaturday)
        return thisWeekend
      case 'next-week':
        const nextWeek = new Date(today)
        nextWeek.setDate(today.getDate() + 7)
        return nextWeek
      case 'next-weekend':
        const nextWeekend = new Date(today)
        const daysUntilNextSaturday = 6 - today.getDay() + 7
        nextWeekend.setDate(today.getDate() + daysUntilNextSaturday)
        return nextWeekend
      case '2-weeks':
        const twoWeeks = new Date(today)
        twoWeeks.setDate(today.getDate() + 14)
        return twoWeeks
      case '4-weeks':
        const fourWeeks = new Date(today)
        fourWeeks.setDate(today.getDate() + 28)
        return fourWeeks
      default:
        return today
    }
  }

  const handleStartDateChange = (date: Date | undefined) => {
    setSelectedStartDate(date)
    if (date) {
      let finalDate = date
      
      // If time is set, combine date with time
      if (startTime) {
        const [hours, minutes] = startTime.split(':').map(Number)
        finalDate = new Date(date)
        finalDate.setHours(hours, minutes, 0, 0)
      }
      
      // Update task with new start date
      onTaskUpdate(task.id, { startDate: finalDate.toISOString() } as any)
    }
    
    // Only close popover if time input is not shown/active
    if (!showTimeInput && !startTime) {
      setIsStartDateOpen(false)
    }
  }

  const handleQuickDateSelect = (type: string) => {
    const date = getQuickDate(type)
    handleStartDateChange(date)
  }

  const handleTimeChange = (time: string) => {
    setStartTime(time)
    
    if (selectedStartDate && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const dateWithTime = new Date(selectedStartDate)
      dateWithTime.setHours(hours, minutes, 0, 0)
      
      // Update task with date including time
      onTaskUpdate(task.id, { startDate: dateWithTime.toISOString() } as any)
    }
  }

  const handleDueTimeChange = (time: string) => {
    setDueTime(time)
    
    if (selectedDueDate && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const dateWithTime = new Date(selectedDueDate)
      dateWithTime.setHours(hours, minutes, 0, 0)
      
      // Update task with due date including time
      onTaskUpdate(task.id, { dueDate: dateWithTime.toISOString() } as any)
    }
  }

  const handleDueDateChange = (date: Date | undefined) => {
    setSelectedDueDate(date)
    if (date) {
      let finalDate = date
      
      // If time is set, combine date with time
      if (dueTime) {
        const [hours, minutes] = dueTime.split(':').map(Number)
        finalDate = new Date(date)
        finalDate.setHours(hours, minutes, 0, 0)
      }
      
      // Update task with new due date
      onTaskUpdate(task.id, { dueDate: finalDate.toISOString() } as any)
    }
    
    // Only close popover if time input is not shown/active
    if (!showDueTimeInput && !dueTime) {
      setIsStartDateOpen(false)
    }
  }

  const handleDatePickerOpen = (mode: "start" | "due") => {
    setDatePickerMode(mode)
    setIsStartDateOpen(true)
  }

  const getCurrentDate = () => {
    return datePickerMode === "start" ? selectedStartDate : selectedDueDate
  }

  const getCurrentTime = () => {
    return datePickerMode === "start" ? startTime : dueTime
  }

  const getShowTimeInput = () => {
    return datePickerMode === "start" ? showTimeInput : showDueTimeInput
  }

  const setCurrentDate = (date: Date | undefined) => {
    if (datePickerMode === "start") {
      handleStartDateChange(date)
    } else {
      handleDueDateChange(date)
    }
  }

  const setCurrentTime = (time: string) => {
    if (datePickerMode === "start") {
      handleTimeChange(time)
    } else {
      handleDueTimeChange(time)
    }
  }

  const setCurrentShowTimeInput = (show: boolean) => {
    if (datePickerMode === "start") {
      setShowTimeInput(show)
    } else {
      setShowDueTimeInput(show)
    }
  }

  const handleTitleEdit = () => {
    setEditedTitle(task.title)
    setIsEditingTitle(true)
  }

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== task.title) {
      onTaskUpdate(task.id, { title: editedTitle.trim() })
    }
    setIsEditingTitle(false)
  }

  const handleTitleCancel = () => {
    setEditedTitle(task.title)
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleTitleCancel()
    }
  }

  // Helper function to format date for display
  const formatDateDisplay = (date: Date | undefined, time: string = ""): string => {
    if (!date) return ""
    
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    let dateStr = ""
    
    // Check if it's today
    if (date.toDateString() === today.toDateString()) {
      dateStr = "Today"
    }
    // Check if it's tomorrow
    else if (date.toDateString() === tomorrow.toDateString()) {
      dateStr = "Tomorrow"
    }
    // Otherwise return formatted date
    else {
      dateStr = date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
    
    // Add time if it's set and not midnight
    if (time && time !== "00:00") {
      const timeStr = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      })
      dateStr += ` at ${timeStr}`
    }
    
    return dateStr
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0 gap-0">
        <div className="flex h-full">
          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <DialogHeader className="p-6 pb-4 border-b">
              <DialogTitle className="sr-only">Task Details: {task.title}</DialogTitle>
              <DialogDescription className="sr-only">
                View and edit task details, assignees, priority, and activity.
              </DialogDescription>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {isEditingTitle ? (
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onBlur={handleTitleSave}
                      onKeyDown={handleTitleKeyDown}
                      className="text-2xl font-semibold mb-2 border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                      autoFocus
                    />
                  ) : (
                    <h2 
                      className="text-2xl font-semibold mb-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                      onClick={handleTitleEdit}
                      title="Click to edit task name"
                    >
                      {task.title}
                    </h2>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Popover open={isStatusOpen} onOpenChange={setIsStatusOpen}>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="h-8 px-3 justify-between min-w-[200px]"
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn("w-3 h-3 rounded-full", currentStatus.color)} />
                              <span className="text-sm">{currentStatus.label}</span>
                            </div>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <div className="p-3 border-b">
                            <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                              <Search className="h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search..."
                                value={statusSearch}
                                onChange={(e) => setStatusSearch(e.target.value)}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8"
                              />
                            </div>
                          </div>
                          <ScrollArea 
                            className="h-[300px]" 
                            onWheel={(e) => {
                              const scrollContainer = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
                              if (scrollContainer) {
                                scrollContainer.scrollTop += e.deltaY;
                              }
                            }}
                          >
                            <div className="p-2 space-y-1">
                              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                Statuses ({filteredStatuses.length})
                              </div>
                              {filteredStatuses.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                  No statuses found
                                </div>
                              ) : (
                                filteredStatuses.map((status) => (
                                  <Button
                                    key={status.id}
                                    variant="ghost"
                                    className={cn(
                                      "w-full justify-between h-10 px-3",
                                      status.id === task.status && "bg-accent"
                                    )}
                                    onClick={() => handleStatusChange(status.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-3 h-3 rounded-full", status.color)} />
                                      <span className="text-sm">{status.label}</span>
                                    </div>
                                    {status.id === task.status && (
                                      <Check className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              <div className="grid grid-cols-3 gap-6 p-6 h-full">
                {/* Left Column */}
                <div className="space-y-6">
                  {/* Assignees */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Assignees</span>
                      </div>
                      <Popover open={isAssigneeOpen} onOpenChange={setIsAssigneeOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <div className="p-3 border-b">
                            <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                              <Search className="h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search or enter email..."
                                value={assigneeSearch}
                                onChange={(e) => setAssigneeSearch(e.target.value)}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8"
                              />
                            </div>
                          </div>
                          <ScrollArea 
                            className="h-[300px]" 
                            onWheel={(e) => {
                              const scrollContainer = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
                              if (scrollContainer) {
                                scrollContainer.scrollTop += e.deltaY;
                              }
                            }}
                          >
                            <div className="p-2 space-y-1">
                              {/* Assignees Section */}
                              {currentAssignees.length > 0 && (
                                <>
                                  <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                    Assignees
                                  </div>
                                  {currentAssignees.map((assignee) => (
                                    <div
                                      key={assignee.id}
                                      className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Avatar className="h-6 w-6">
                                          <AvatarFallback className="text-xs">
                                            {assignee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                          <span className="text-sm">{assignee.name}</span>
                                          <span className="text-xs text-muted-foreground">{assignee.email}</span>
                                        </div>
                                      </div>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        ×
                                      </Button>
                                    </div>
                                  ))}
                                  <div className="h-2"></div>
                                </>
                              )}

                              {/* People Section */}
                              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                People
                              </div>
                              {peopleList
                                .filter(person => 
                                  person.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                                  person.email.toLowerCase().includes(assigneeSearch.toLowerCase())
                                )
                                .map((person) => (
                                  <Button
                                    key={person.id}
                                    variant="ghost"
                                    className="w-full justify-start h-auto p-2"
                                    onClick={() => handleAssigneeChange(person.name)}
                                  >
                                    <div className="flex items-center gap-3 w-full">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs">
                                          {person.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex flex-col items-start flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm">{person.name}</span>
                                          {person.verified && (
                                            <div className="w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                                              <Check className="h-2 w-2 text-white" />
                                            </div>
                                          )}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{person.email}</span>
                                      </div>
                                    </div>
                                  </Button>
                                ))}

                              <div className="h-2"></div>

                              {/* Team Section */}
                              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                Team
                              </div>
                              {teamList
                                .filter(team => 
                                  team.name.toLowerCase().includes(assigneeSearch.toLowerCase())
                                )
                                .map((team) => (
                                  <Button
                                    key={team.id}
                                    variant="ghost"
                                    className="w-full justify-start h-auto p-2"
                                    onClick={() => handleAssigneeChange(team.name)}
                                  >
                                    <div className="flex items-center gap-3 w-full">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-xs">
                                          {team.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex flex-col items-start flex-1">
                                        <span className="text-sm">{team.name}</span>
                                        <span className="text-xs text-muted-foreground">{team.members} members</span>
                                      </div>
                                    </div>
                                  </Button>
                                ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(task.assignee)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{task.assignee}</span>
                    </div>
                  </div>

                  {/* Dates */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Dates</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Start</span>
                        <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                          <PopoverTrigger asChild>
                            {selectedStartDate ? (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-6 text-xs"
                                onClick={() => handleDatePickerOpen("start")}
                              >
                                {formatDateDisplay(selectedStartDate, startTime)}
                              </Button>
                            ) : (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 text-xs"
                                onClick={() => handleDatePickerOpen("start")}
                              >
                                Add start date
                              </Button>
                            )}
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            {/* Date Type Tabs */}
                            <div className="flex border-b">
                              <Button
                                variant={datePickerMode === "start" ? "default" : "ghost"}
                                size="sm"
                                className="flex-1 rounded-none border-0"
                                onClick={() => setDatePickerMode("start")}
                              >
                                Start Date
                              </Button>
                              <Button
                                variant={datePickerMode === "due" ? "default" : "ghost"}
                                size="sm"
                                className="flex-1 rounded-none border-0"
                                onClick={() => setDatePickerMode("due")}
                              >
                                Due Date
                              </Button>
                            </div>
                            
                            <div className="flex">
                              {/* Quick Date Options */}
                              <div className="w-48 border-r">
                                <div className="p-3 space-y-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('today')}
                                  >
                                    Today
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('tomorrow')}
                                  >
                                    Tomorrow
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('this-weekend')}
                                  >
                                    This weekend
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('next-week')}
                                  >
                                    Next week
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('next-weekend')}
                                  >
                                    Next weekend
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('2-weeks')}
                                  >
                                    2 weeks
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs"
                                    onClick={() => handleQuickDateSelect('4-weeks')}
                                  >
                                    4 weeks
                                  </Button>
                                  <Separator className="my-2" />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs text-muted-foreground"
                                  >
                                    Set Recurring
                                  </Button>
                                </div>
                              </div>
                              {/* Calendar */}
                              <div className="p-3">
                                <Calendar
                                  mode="single"
                                  selected={getCurrentDate()}
                                  onSelect={setCurrentDate}
                                  initialFocus
                                />
                                
                                {/* Time Section */}
                                <div className="mt-3 pt-3 border-t">
                                  {!getShowTimeInput() && !getCurrentTime() ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full justify-start text-xs"
                                      onClick={() => setCurrentShowTimeInput(true)}
                                    >
                                      <Clock className="h-3 w-3 mr-2" />
                                      Add time
                                    </Button>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs font-medium">Time</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="time"
                                          value={getCurrentTime()}
                                          onChange={(e) => setCurrentTime(e.target.value)}
                                          className="flex-1 h-8 text-xs"
                                        />
                                        {getCurrentTime() && (
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => {
                                              setCurrentTime("")
                                              setCurrentShowTimeInput(false)
                                              // Update task to remove time
                                              if (getCurrentDate()) {
                                                if (datePickerMode === "start") {
                                                  onTaskUpdate(task.id, { startDate: getCurrentDate()!.toISOString() } as any)
                                                } else {
                                                  onTaskUpdate(task.id, { dueDate: getCurrentDate()!.toISOString() } as any)
                                                }
                                              }
                                            }}
                                          >
                                            ×
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Done button when time input is active */}
                                  {(getShowTimeInput() || getCurrentTime()) && getCurrentDate() && (
                                    <div className="mt-2 pt-2 border-t">
                                      <Button
                                        size="sm"
                                        className="w-full text-xs"
                                        onClick={() => {
                                          setCurrentShowTimeInput(false)
                                          setIsStartDateOpen(false)
                                        }}
                                      >
                                        Done
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Due</span>
                        {selectedDueDate ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-6 text-xs"
                            onClick={() => handleDatePickerOpen("due")}
                          >
                            {formatDateDisplay(selectedDueDate, dueTime)}
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs"
                            onClick={() => handleDatePickerOpen("due")}
                          >
                            Add due date
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Flag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Priority</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu open={isPriorityOpen} onOpenChange={setIsPriorityOpen}>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="flex-1 justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <Flag className={cn("h-3 w-3", priorityColors[task.priority])} />
                              <span className="capitalize">{task.priority}</span>
                            </div>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {priorityOptions.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              onClick={() => handlePriorityChange(option.value as any)}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <Flag className={cn("h-3 w-3", option.color)} />
                                <span>{option.label}</span>
                              </div>
                              {task.priority === option.value && (
                                <Check className="h-3 w-3" />
                              )}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem
                            onClick={() => handlePriorityChange("normal")}
                            className="flex items-center gap-2"
                          >
                            <div className="h-3 w-3 rounded-full border border-muted-foreground flex items-center justify-center">
                              <div className="h-1 w-1 bg-muted-foreground rounded-full"></div>
                            </div>
                            <span>Clear</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {task.priority !== "normal" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => handlePriorityChange("normal")}
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Tags</span>
                    </div>
                    <div className="space-y-2">
                      {/* Existing Tags */}
                      <div className="flex flex-wrap gap-1">
                        {task.tags.length > 0 ? (
                          task.tags.map(tag => (
                            <Badge 
                              key={tag} 
                              variant="secondary" 
                              className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => handleRemoveTag(tag)}
                            >
                              {tag}
                              <span className="ml-1 text-xs">×</span>
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground italic">No tags</span>
                        )}
                      </div>
                      
                      {/* Add Tag Input */}
                      {isAddingTag ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={newTag}
                            onChange={(e) => setNewTag(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                            placeholder="Enter tag name..."
                            className="flex-1 h-8 text-xs"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={handleAddTag}
                            disabled={!newTag.trim()}
                            className="h-8 px-2"
                          >
                            Add
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNewTag("")
                              setIsAddingTag(false)
                            }}
                            className="h-8 w-8 p-0"
                          >
                            ×
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsAddingTag(true)}
                          className="h-8 justify-start text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add tag
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Relationships */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Link className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Relationships</span>
                      </div>
                      <Popover open={isRelationshipsOpen} onOpenChange={setIsRelationshipsOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Plus className="h-3 w-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <div className="p-3 border-b">
                            <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
                              <Search className="h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search tasks..."
                                value={relationshipSearch}
                                onChange={(e) => setRelationshipSearch(e.target.value)}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8"
                              />
                            </div>
                          </div>
                          <ScrollArea 
                            className="h-[300px]"
                            onWheel={(e) => {
                              const scrollContainer = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
                              if (scrollContainer) {
                                scrollContainer.scrollTop += e.deltaY;
                              }
                            }}
                          >
                            <div className="p-2 space-y-1">
                              <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                Tasks
                              </div>
                              {tasks
                                ?.filter(t => 
                                  t.id !== task.id && 
                                  (t.title.toLowerCase().includes(relationshipSearch.toLowerCase()) ||
                                   t.id.toLowerCase().includes(relationshipSearch.toLowerCase()))
                                )
                                .map((relatedTask) => (
                                  <div key={relatedTask.id} className="space-y-1">
                                    <div className="flex items-center justify-between p-2 rounded hover:bg-accent">
                                      <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                                        <div className="flex flex-col">
                                          <span className="text-sm font-medium">{relatedTask.title}</span>
                                          <span className="text-xs text-muted-foreground">#{relatedTask.id}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-1 ml-8">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => handleAddRelationship(relatedTask.id, "blocks")}
                                      >
                                        Blocks
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => handleAddRelationship(relatedTask.id, "depends_on")}
                                      >
                                        Depends on
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs"
                                        onClick={() => handleAddRelationship(relatedTask.id, "related_to")}
                                      >
                                        Related to
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </ScrollArea>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      {(task.relationships || []).length > 0 ? (
                        <ScrollArea 
                          className="h-32"
                          onWheel={(e) => {
                            const scrollContainer = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
                            if (scrollContainer) {
                              scrollContainer.scrollTop += e.deltaY;
                            }
                          }}
                        >
                          <div className="space-y-2 pr-4">
                            {(task.relationships || []).map((relationship, index) => {
                              const relatedTask = tasks?.find(t => t.id === relationship.taskId)
                              return relatedTask ? (
                                <div key={index} className="flex items-center justify-between p-2 border rounded">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground capitalize">{relationship.type.replace('_', ' ')}</span>
                                    <span className="text-sm font-medium">{relatedTask.title}</span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleRemoveRelationship(relationship)}
                                  >
                                    ×
                                  </Button>
                                </div>
                              ) : null
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">No relationships</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Middle Column */}
                <div className="space-y-6">
                  {/* Description */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">Description</span>
                    </div>
                    <div className="border rounded-md p-3 min-h-[100px]">
                      {isEditingDescription ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editedDescription}
                            onChange={(e) => setEditedDescription(e.target.value)}
                            onKeyDown={handleDescriptionKeyDown}
                            placeholder="Enter task description..."
                            className="min-h-[80px] resize-none"
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleDescriptionCancel}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleDescriptionSave}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {task.description ? (
                            <div 
                              className="text-sm cursor-pointer hover:bg-muted/50 rounded p-2 -m-2"
                              onClick={handleDescriptionEdit}
                            >
                              {task.description}
                            </div>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 justify-start text-muted-foreground"
                              onClick={handleDescriptionEdit}
                            >
                              Add description
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div>
                    <h4 className="font-medium mb-3">Details</h4>
                    <div className="space-y-4">
                      {/* Custom Fields */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="text-sm font-medium">Custom Fields</h5>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={addCustomField}
                            className="h-6 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Field
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-48">
                          <ScrollArea className="h-48">
                            <div className="space-y-2 pr-4">
                              {customFields.length > 0 ? (
                                customFields.map((field, index) => (
                                  <Card key={field.id} className="p-3">
                                    <div className="flex items-start gap-3">
                                      <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            Field {index + 1}
                                          </Badge>
                                          <Input
                                            value={field.title}
                                            onChange={(e) => updateCustomField(field.id, { title: e.target.value })}
                                            placeholder="Field title"
                                            className="h-8 text-sm"
                                          />
                                        </div>
                                        <Input
                                          value={field.description}
                                          onChange={(e) => updateCustomField(field.id, { description: e.target.value })}
                                          placeholder="Field value"
                                          className="h-8 text-sm"
                                        />
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                        onClick={() => removeCustomField(field.id)}
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  </Card>
                                ))
                              ) : (
                                <div className="text-center py-6 text-muted-foreground">
                                  <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                      <Plus className="h-4 w-4" />
                                    </div>
                                    <div className="text-sm">
                                      <p className="font-medium">No custom fields</p>
                                      <p className="text-xs">Add custom fields to store additional information</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>

                      {/* Attachments */}
                      <div>
                        <h5 className="text-sm font-medium mb-3">Attachments</h5>
                        <div
                          className={cn(
                            "border-2 border-dashed rounded-md p-6 text-center transition-colors",
                            isDragOver 
                              ? "border-primary bg-primary/5" 
                              : "border-muted hover:border-muted-foreground"
                          )}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setIsDragOver(true)
                          }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handleFileDrop}
                        >
                          {isDragOver ? (
                            <div className="text-primary font-medium">Drop files here</div>
                          ) : (
                            <div>
                              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground mb-2">
                                Drop your files here or{" "}
                                <label className="text-primary cursor-pointer hover:underline">
                                  browse
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*,.pdf,.doc,.docx,.txt,.xlsx,.xls,.pptx,.ppt,.zip,.rar,.7z"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                  />
                                </label>
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {uploadedFiles.length > 0 && (
                          <div className="mt-3">
                            <DropdownMenu open={isAttachmentsOpen} onOpenChange={setIsAttachmentsOpen}>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  className="w-full justify-between"
                                >
                                  <div className="flex items-center gap-2">
                                    <Paperclip className="h-4 w-4" />
                                    <span className="text-sm">
                                      {uploadedFiles.length} attachment{uploadedFiles.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-64">
                                <div className="p-2">
                                  <div className="text-xs font-medium text-muted-foreground mb-2">
                                    Attachments ({uploadedFiles.length})
                                  </div>
                                  {uploadedFiles.map(file => (
                                    <div key={file.id} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        <span className="text-sm truncate">{file.name}</span>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">
                                          ({(file.size / 1024).toFixed(1)} KB)
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 flex-shrink-0"
                                        onClick={() => removeFile(file.id)}
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Activity */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Activity</h3>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Search className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Bell className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Settings className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Activity content */}
                  <ScrollArea 
                    className="h-[300px]"
                    onWheel={(e) => {
                      const scrollContainer = e.currentTarget.querySelector('[data-radix-scroll-area-viewport]');
                      if (scrollContainer) {
                        scrollContainer.scrollTop += e.deltaY;
                      }
                    }}
                  >
                    <div className="space-y-3 p-2">
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>You set priority to</span>
                          <Flag className={cn("h-3 w-3", priorityColors[task.priority])} />
                          <span className="font-medium capitalize">{task.priority}</span>
                        </div>
                        <span>6 mins</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Task created</span>
                        </div>
                        <span>2 hours</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Assigned to</span>
                          <span className="font-medium">{task.assignee}</span>
                        </div>
                        <span>3 hours</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Due date set to</span>
                          <span className="font-medium">{new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                        <span>1 day</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Description updated</span>
                        </div>
                        <span>2 days</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Tags added</span>
                        </div>
                        <span>3 days</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 mb-1">
                          <span>Task moved to</span>
                          <span className="font-medium">In Progress</span>
                        </div>
                        <span>1 week</span>
                      </div>
                    </div>
                  </ScrollArea>

                  {/* Comment Input */}
                  <div className="mt-4 space-y-2">
                    <Textarea
                      placeholder="Write a comment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex justify-end">
                      <Button size="sm">Send</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 