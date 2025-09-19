"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  MoreHorizontal, 
  Plus, 
  Flag, 
  Calendar, 
  GripVertical,
  Trash2,
  Edit3,
  ArrowRight,
  Paperclip
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { TaskDetailDialog } from "./task-detail-dialog"
import React, { useRef } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { toast } from "sonner"

interface Task {
  id: string
  creator_id?: number
  is_owner?: boolean
  title: string
  description: string
  priority: "urgent" | "high" | "normal" | "low"
  assignee: string
  assignees?: number[]
  startDate?: string
  dueDate: string
  tags: string[]
  status: string
  relationships?: Array<{ taskId: string; type: string }>
  attachments?: Array<{ id: string; name: string; url: string; type: string }>
}

interface Column {
  id: string
  title: string
  color: string
}

interface KanbanBoardProps {
  tasks: Task[]
  columns: Column[]
  onTaskMove: (taskId: string, newStatus: string, targetPosition?: number) => void
  onTaskCreate: (status: string) => void
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void
  onTaskRename?: (taskId: string, newTitle: string) => void
  onColumnsReorder?: (columns: Column[]) => void
  isEditMode?: boolean
  // Zoom percentage from parent (e.g., 100 = 1x, 150 = 1.5x)
  zoom?: number
  onTaskDelete?: (taskId: string) => void
}

const TaskCard = ({ 
  task, 
  onMove, 
  onTaskClick,
  isEditMode = false,
  onDelete,
  onRename,
  availableGroups,
  usersMap
}: { 
  task: Task; 
  onMove: (newStatus: string) => void;
  onTaskClick: (task: Task) => void;
  isEditMode?: boolean;
  onDelete?: (taskId: string) => void;
  onRename?: (taskId: string, newTitle: string) => void;
  availableGroups?: Array<{id: string, title: string}>;
  usersMap?: Record<number, { name?: string; email?: string }>;
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const dragImageRef = useRef<HTMLElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newTitle, setNewTitle] = useState(task.title)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const renameInputRef = useRef<HTMLInputElement>(null)

  const priorityColors = {
    urgent: "bg-pink-500",
    high: "bg-yellow-500", 
    normal: "bg-blue-500",
    low: "bg-gray-500"
  }

  const handleDragStart = (e: any) => {
    if (isEditMode) {
      return
    }
    setIsDragging(true)
    try {
      // Create a custom drag image to avoid flicker/hidden animation when ancestors clip overflow or when zoomed
      const cardEl = cardRef.current
      if (e.dataTransfer && cardEl) {
        const clone = cardEl.cloneNode(true) as HTMLElement
        clone.style.position = 'absolute'
        clone.style.top = '-10000px'
        clone.style.left = '-10000px'
        clone.style.pointerEvents = 'none'
        clone.style.transform = 'scale(0.98)'
        clone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.2)'
        clone.style.opacity = '0.9'
        clone.style.width = `${cardEl.offsetWidth}px`
        document.body.appendChild(clone)
        dragImageRef.current = clone
        e.dataTransfer.setDragImage(clone, Math.floor(clone.offsetWidth / 2), 16)
      }
    } catch {}
  }

  const handleDragEnd = () => {
    if (isEditMode) return
    setIsDragging(false)
    try {
      if (dragImageRef.current) {
        dragImageRef.current.remove()
        dragImageRef.current = null
      }
    } catch {}
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent click when dragging, clicking dropdown menu, in edit mode, or when renaming
    if (!isDragging && !e.defaultPrevented && !isEditMode && !isRenaming) {
      onTaskClick(task)
    }
  }

  const handleDropdownClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if user has permission to delete this task
    const isTaskOwner = task.is_owner === true
    if (!isTaskOwner) {
      toast.error("Cannot delete task", {
        description: "Only the task creator can delete tasks. Contact the creator to request deletion.",
        duration: 4000,
      })
      return
    }
    
    onDelete?.(task.id)
  }

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDropdownOpen(false) // Close the dropdown menu
    
    // Check if user has permission to rename this task
    const isTaskOwner = task.is_owner === true
    if (!isTaskOwner) {
      toast.error("Cannot rename task", {
        description: "Only the task creator can rename tasks. Contact the creator to request changes.",
        duration: 4000,
      })
      return
    }
    
    setIsRenaming(true)
    setNewTitle(task.title) // Reset to current title
    // Use a longer timeout to ensure dropdown is fully closed
    setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus()
        renameInputRef.current.select()
      }
    }, 200)
  }

  const handleRenameSave = () => {
    if (newTitle.trim() && newTitle !== task.title) {
      onRename?.(task.id, newTitle.trim())
    }
    setIsRenaming(false)
  }

  const handleRenameCancel = () => {
    setNewTitle(task.title)
    setIsRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleRenameSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleRenameCancel()
    }
  }

  const handleRenameBlur = (e: React.FocusEvent) => {
    // Only save if we're actually in renaming mode and the blur is not to the dropdown
    if (isRenaming) {
      // Check if the related target is part of the dropdown menu
      const target = e.relatedTarget as HTMLElement
      const isDropdownElement = target?.closest('[role="menu"]') || target?.closest('[data-radix-popper-content-wrapper]')
      
      if (!isDropdownElement) {
        handleRenameSave()
      }
    }
  }

  const handleMoveTask = (e: React.MouseEvent, newStatus: string) => {
    e.preventDefault()
    e.stopPropagation()
    onMove(newStatus)
  }

  const handleMoveToClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Do nothing - this prevents the Move to trigger from being clickable
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ 
        duration: 0.2,
        ease: "easeOut",
        layout: { duration: 0.3, ease: "easeInOut" }
      }}
      whileDrag={{ 
        scale: 1.01,
        zIndex: 10,
        boxShadow: "0 1px 3px -1px rgba(0, 0, 0, 0.03)",
        transition: { 
          duration: 0.1,
          ease: "easeOut"
        }
      }}

      onClick={handleCardClick}
      className={cn(
        "mb-3 transition-all overflow-hidden",
        isDragging && "opacity-50",
        isEditMode 
          ? "cursor-default" 
          : "cursor-pointer"
      )}
    >
      <div
        data-task-id={task.id}
        draggable={!isEditMode}
        onDragStart={(e: React.DragEvent) => {
          if (!isEditMode) {
            e.dataTransfer.setData("taskId", task.id)
            setIsDragging(true)
          }
        }}
        onDragEnd={() => {
          if (!isEditMode) {
            setIsDragging(false)
          }
        }}
        style={{ pointerEvents: isEditMode ? 'none' : 'auto' }}
      >
        <Card ref={cardRef} className={cn(
          "w-full shadow-none border overflow-hidden transition-transform",
          isDragging && "scale-[1.02] ring-2 ring-primary shadow-lg",
          (task as any).isOverdue ? "border-red-500 dark:border-red-600 border-2" : 
          (task as any).dueSoon ? "border-red-300 dark:border-red-800" : 
          (task as any).isDone ? "border-green-300 dark:border-green-800" : 
          "border-border/50"
        )}>
          {/* Cover Photo */}
            {task.attachments && (task.attachments as any).length > 0 && (
            <div className="relative w-full h-32 bg-muted">
              <Image
                src={(task.attachments as any)[0].url}
                alt={task.attachments[0].name}
                fill
                className="object-cover"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onError={(e) => {
                  // Fallback to a placeholder if image fails to load
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                  target.parentElement!.innerHTML = `
                    <div class="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-sm">
                      <div class="text-center">
                        <div class="text-2xl mb-1">📎</div>
                        <div>${task.attachments?.length || 0} attachment${(task.attachments?.length || 0) > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  `
                }}
              />
               {task.attachments && (task.attachments as any).length > 1 && (
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
                 +{(task.attachments as any).length - 1}
                </div>
              )}
            </div>
          )}

          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              {isRenaming ? (
                                 <input
                   ref={renameInputRef}
                   type="text"
                   value={newTitle}
                   onChange={(e) => setNewTitle(e.target.value)}
                   onBlur={handleRenameBlur}
                   onKeyDown={handleRenameKeyDown}
                   onClick={(e) => e.stopPropagation()}
                   onMouseDown={(e) => e.stopPropagation()}
                   className="text-sm font-medium leading-none bg-background border border-input rounded px-2 py-1 focus:ring-2 focus:ring-ring focus:border-ring min-w-0"
                   style={{ maxWidth: '140px' }}
                   autoFocus
                   onFocus={(e) => e.target.select()}
                 />
              ) : (
                                 <div className="flex items-center gap-2 min-w-0 flex-1">
                   <div className="min-w-0 flex-1">
                     <h4 
                       className="text-sm font-medium leading-none truncate block" 
                       title={task.title}
                       style={{ maxWidth: '140px' }}
                     >
                       {task.title}
                     </h4>
                   </div>
                   <div className="flex items-center gap-1 flex-shrink-0">
                     {(task as any).isOverdue && (
                       <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500 text-white dark:bg-red-600 dark:text-white">
                         Overdue
                       </span>
                     )}
                     {(task as any).dueSoon && !(task as any).isOverdue && (
                       <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400">
                         Due soon
                       </span>
                     )}
                     {(task as any).isDone && (
                       <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400">
                         Complete
                       </span>
                     )}
                     {task.is_owner === false && (
                       <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400">
                         Assigned
                       </span>
                     )}
                   </div>
                 </div>
              )}
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild onClick={handleDropdownClick}>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onDragStart={(e) => e.preventDefault()}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRename} onDragStart={(e) => e.preventDefault()}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger onClick={handleMoveToClick} onDragStart={(e) => e.preventDefault()}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Move to
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {availableGroups?.filter(group => group.id !== task.status).map((group) => (
                        <DropdownMenuItem 
                          key={group.id} 
                          onClick={(e) => handleMoveTask(e, group.id)}
                          onDragStart={(e) => e.preventDefault()}
                        >
                          {group.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="text-red-600" onDragStart={(e) => e.preventDefault()}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
                         <p 
               className="text-xs text-muted-foreground mb-3 line-clamp-2 task-description max-w-full" 
               title={task.description}
             >
               {task.description}
             </p>
            
            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {task.tags.map(tag => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="text-xs"
                    onDragStart={(e) => e.preventDefault()}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Footer */}
            <div className="flex items-start justify-between min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex flex-col items-start gap-1 min-w-0">
                  {/* Priority */}
                  <div className="flex items-center gap-1 min-w-0 mb-4">
                    <Flag className={cn("h-3 w-3 flex-shrink-0", priorityColors[task.priority])} />
                    <span className="text-xs capitalize truncate">{task.priority}</span>
                    {/* Attachments */}
                    {task.attachments && task.attachments.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Paperclip className="h-3 w-3" />
                        <span>{task.attachments.length}</span>
                      </div>
                    )}
                  </div>
                  

                  {/* Dates (Start & Due) */}
                  {(() => {
                    const fmt = (value?: string) => {
                      if (!value) return 'Not set'
                      const d = new Date(value)
                      return isNaN(d.getTime()) ? 'Not set' : d.toLocaleDateString()
                    }
                    const startStr = fmt(task.startDate)
                    const dueStr = fmt(task.dueDate)
                    return (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                        <Calendar className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">Start: {startStr}</span>
                        <span className="opacity-60">•</span>
                        <span className={cn("truncate", 
                          (task as any).isOverdue && "text-red-500 dark:text-red-400 font-bold",
                          (task as any).dueSoon && !(task as any).isOverdue && "text-red-600 dark:text-red-400 font-medium",
                          (task as any).isDone && "text-green-600 dark:text-green-400 font-medium"
                        )}>Due: {dueStr}</span>
                      </div>
                    )
                  })()}
                </div>

                
              </div>
              
              {/* Assignees */}
              {Array.isArray((task as any).assignees) && (task as any).assignees.length > 0 ? (
                <div className="flex items-center gap-1">
                  {(() => {
                    const ids = ((task as any).assignees as number[])
                    const first = ids[0]
                    const label = usersMap?.[first]?.name || usersMap?.[first]?.email || String(first)
                    const firstInitials = getInitials(label)
                    const extraCount = ids.length - 1
                    return (
                      <>
                        <Avatar className="h-6 w-6" onDragStart={(e) => e.preventDefault()}>
                          <AvatarFallback className="text-xs">{firstInitials}</AvatarFallback>
                        </Avatar>
                        {extraCount > 0 && (
                          <span className="text-xs text-muted-foreground px-1 rounded bg-muted/60" onDragStart={(e) => e.preventDefault()}>+{extraCount}</span>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <Avatar className="h-6 w-6" onDragStart={(e) => e.preventDefault()}>
                  <AvatarFallback className="text-xs">{getInitials(task.assignee)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}

const KanbanColumn = ({ 
  column, 
  tasks, 
  onTaskMove,
  onTaskClick,
  onTaskCreate,
  isEditMode = false,
  onTaskDelete,
  onTaskRename,
  availableGroups,
  usersMap
}: { 
  column: Column; 
  tasks: Task[]; 
  onTaskMove: (taskId: string, newStatus: string, targetPosition?: number) => void;
  onTaskClick: (task: Task) => void;
  onTaskCreate: (status: string) => void;
  isEditMode?: boolean;
  onTaskDelete?: (taskId: string) => void;
  onTaskRename?: (taskId: string, newTitle: string) => void;
  availableGroups?: Array<{id: string, title: string}>;
  usersMap: Record<number, { name?: string; email?: string }>;
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropPosition, setDropPosition] = useState<number | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
    
    // Calculate drop position for visual feedback
    const dropZone = e.currentTarget as HTMLElement
    const dropRect = dropZone.getBoundingClientRect()
    const dropY = e.clientY - dropRect.top
    
    const taskElements = dropZone.querySelectorAll('[data-task-id]')
    let targetPosition = 1
    
    if (taskElements.length === 0) {
      targetPosition = 1
    } else {
      // Create more precise drop zones with better sensitivity
      const DROP_ZONE_HEIGHT = 20 // Height of the drop zone between tasks
      const EDGE_SENSITIVITY = 15 // How close to edges to trigger drops
      
      for (let i = 0; i < taskElements.length; i++) {
        const taskElement = taskElements[i] as HTMLElement
        const taskRect = taskElement.getBoundingClientRect()
        const taskTop = taskRect.top - dropRect.top
        const taskBottom = taskRect.bottom - dropRect.top
        
        // Create a drop zone above this task
        const dropZoneTop = Math.max(0, taskTop - DROP_ZONE_HEIGHT)
        const dropZoneBottom = taskTop + EDGE_SENSITIVITY
        
        // Create a drop zone below this task (for the last task)
        const nextTaskBottom = i === taskElements.length - 1 
          ? taskBottom + DROP_ZONE_HEIGHT 
          : taskBottom + EDGE_SENSITIVITY
        
        // Check if mouse is in the drop zone above this task
        if (dropY >= dropZoneTop && dropY <= dropZoneBottom) {
          targetPosition = i + 1
          break
        }
        // Check if mouse is in the drop zone below this task
        else if (dropY > taskBottom - EDGE_SENSITIVITY && dropY <= nextTaskBottom) {
          targetPosition = i + 2
          break
        }
        // If this is the last task and mouse is below it
        else if (i === taskElements.length - 1 && dropY > taskBottom) {
          targetPosition = i + 2
          break
        }
      }
    }
    
    setDropPosition(targetPosition)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
    setDropPosition(null)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    setDropPosition(null)
    const taskId = e.dataTransfer.getData("taskId")
    if (taskId) {
      // Use the same precise logic as handleDragOver for consistency
      const dropZone = e.currentTarget as HTMLElement
      const dropRect = dropZone.getBoundingClientRect()
      const dropY = e.clientY - dropRect.top
      
      const taskElements = dropZone.querySelectorAll('[data-task-id]')
      let targetPosition = 1
      
      if (taskElements.length === 0) {
        targetPosition = 1
      } else {
        // Use the same precise drop zone logic
        const DROP_ZONE_HEIGHT = 20
        const EDGE_SENSITIVITY = 15
        
        for (let i = 0; i < taskElements.length; i++) {
          const taskElement = taskElements[i] as HTMLElement
          const taskRect = taskElement.getBoundingClientRect()
          const taskTop = taskRect.top - dropRect.top
          const taskBottom = taskRect.bottom - dropRect.top
          
          const dropZoneTop = Math.max(0, taskTop - DROP_ZONE_HEIGHT)
          const dropZoneBottom = taskTop + EDGE_SENSITIVITY
          
          const nextTaskBottom = i === taskElements.length - 1 
            ? taskBottom + DROP_ZONE_HEIGHT 
            : taskBottom + EDGE_SENSITIVITY
          
          if (dropY >= dropZoneTop && dropY <= dropZoneBottom) {
            targetPosition = i + 1
            break
          }
          else if (dropY > taskBottom - EDGE_SENSITIVITY && dropY <= nextTaskBottom) {
            targetPosition = i + 2
            break
          }
          else if (i === taskElements.length - 1 && dropY > taskBottom) {
            targetPosition = i + 2
            break
          }
        }
      }
      onTaskMove(taskId, column.id, targetPosition)
    }
  }

  const handleAddTask = () => {
    onTaskCreate(column.id)
  }

  const columnTasks = tasks.filter(task => task.status === column.id)

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileDrag={{ 
        zIndex: 1000,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        transition: { 
          duration: 0.2,
          ease: "easeOut"
        }
      }}
      className={cn(
        "flex flex-col w-80 bg-muted/20 rounded-lg p-4 h-full border border-border/30",
        isEditMode && "cursor-move"
      )}
      style={{ 
        width: '100%',
        height: '100%',
        minHeight: '500px',
        maxHeight: 'calc(100vh - 200px)'
      }}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isEditMode && (
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
          )}
          <h3 className="font-semibold text-sm">{column.title}</h3>
                     <Badge variant="secondary" className={`text-xs ${column.color}`}>
             {columnTasks.length}
           </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddTask}
            className="h-6 w-6 p-0 hover:bg-background/80"
            onDragStart={(e) => e.preventDefault()}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Drop Zone */}
      <motion.div
        layout
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden transition-all duration-200 rounded-md kanban-scrollbar",
          isDragOver && "bg-primary/10 border-2 border-dashed border-primary shadow-inner"
        )}
        transition={{ 
          layout: { duration: 0.2, ease: "easeInOut" },
          backgroundColor: { duration: 0.1 }
        }}
      >
        <AnimatePresence mode="popLayout">
          {columnTasks.map((task, index) => (
            <motion.div 
              key={task.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.1 }}
            >
                {/* Drop placeholder - shows before this task */}
                {isDragOver && dropPosition === index + 1 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 4 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="mb-3 flex items-center justify-center"
                  >
                    <div className="w-full h-1 bg-primary border border-primary rounded-full shadow-lg"></div>
                  </motion.div>
                )}
              <TaskCard
                task={task}
                onMove={(newStatus) => onTaskMove(task.id, newStatus)}
                onTaskClick={onTaskClick}
                isEditMode={isEditMode}
                onDelete={onTaskDelete} // Pass onDelete to TaskCard
                onRename={onTaskRename} // Pass onRename to TaskCard
                availableGroups={availableGroups}
                usersMap={usersMap}
              />
            </motion.div>
          ))}
          {/* Drop placeholder at the end - only show if no tasks or if dropping at the very end */}
          {isDragOver && (columnTasks.length === 0 || dropPosition === columnTasks.length + 1) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 4 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mb-3 flex items-center justify-center"
            >
              <div className="w-full h-1 bg-primary border-2 border-primary rounded-full shadow-lg"></div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {columnTasks.length === 0 && !isDragOver && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center h-32 text-muted-foreground text-sm"
          >
            No tasks
          </motion.div>
        )}
      </motion.div>

      {/* Add Task Button */}
      <div className="mt-3 flex-shrink-0">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleAddTask}
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onDragStart={(e) => e.preventDefault()}
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Task
        </Button>
      </div>
    </motion.div>
  )
}

export function KanbanBoard({ tasks, columns, onTaskMove, onTaskCreate, onTaskUpdate, onTaskRename, onColumnsReorder, isEditMode = false, zoom = 100, onTaskDelete }: KanbanBoardProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [localColumns, setLocalColumns] = useState(columns)
  const [usersMap, setUsersMap] = useState<Record<number, { name?: string; email?: string }>>({})
  const [isScrolling, setIsScrolling] = useState(false)
  const [scrollStart, setScrollStart] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Column reordering state
  const [isColumnDragOver, setIsColumnDragOver] = useState(false)
  const [columnDropPosition, setColumnDropPosition] = useState<number | null>(null)

  // Derived zoom scale and layout width multiplier
  const zoomScale = Math.max(0.5, Math.min(2, zoom / 100))
  // When zoomed in, don't force extra width; let content's max-content decide.
  // When zoomed out, expand width so the scaled-down content still fills the container.
  const zoomWrapperWidth = zoomScale > 1 ? 'max-content' : `${100 / zoomScale}%`

  // Filter out deleted tasks
  const activeTasks = tasks.filter(task => task.status !== "deleted")

  // Keep the open task detail dialog in sync with live updates to the task list
  React.useEffect(() => {
    if (!selectedTask) return
    const latest = activeTasks.find(t => t.id === selectedTask.id)
    if (!latest) return
    const normalize = (t: any) => ({
      id: String(t.id),
      title: t.title,
      description: t.description,
      priority: t.priority,
      group_id: (t as any).group_id,
      status: t.status,
      startDate: (t as any).startDate,
      dueDate: (t as any).dueDate,
      tags: Array.isArray(t.tags) ? [...t.tags].sort() : [],
      assignees: Array.isArray((t as any).assignees) ? [...(t as any).assignees].sort() : [],
      relationships: Array.isArray((t as any).relationships) ? [...(t as any).relationships].map((r:any)=>String(r.taskId)).sort() : [],
      custom_fields: Array.isArray((t as any).custom_fields) ? [...(t as any).custom_fields].map((f:any)=>String(f.id)).sort() : [],
      attachments: Array.isArray((t as any).attachments) ? [...(t as any).attachments].map((a:any)=>String(a.id)).sort() : [],
      updated_at: (t as any).updated_at || null
    })
    const a = JSON.stringify(normalize(latest))
    const b = JSON.stringify(normalize(selectedTask))
    // Use a ref to avoid thrashing on equality checks across renders
    ;(KanbanBoard as any).__lastSelectedSnapshot = (KanbanBoard as any).__lastSelectedSnapshot || ''
    const last = (KanbanBoard as any).__lastSelectedSnapshot as string
    if (a !== b && a !== last) {
      (KanbanBoard as any).__lastSelectedSnapshot = a
      setSelectedTask(prev => (prev ? { ...prev, ...latest } : latest))
    }
  }, [activeTasks, selectedTask])

  // Helper to ensure unique columns by id while preserving order
  const uniqueColumns = (cols: Column[]) => {
    const seen = new Set<string>()
    const result: Column[] = []
    for (const c of cols) {
      const key = String(c.id)
      if (!seen.has(key)) {
        seen.add(key)
        result.push(c)
      }
    }
    return result
  }

  // Update localColumns when columns prop changes (e.g., when new groups are added)
  React.useEffect(() => {
    setLocalColumns(uniqueColumns(columns))
  }, [columns])

  // Load minimal users map for initials on cards
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/users/?limit=500', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && Array.isArray(data.users)) {
          const map: Record<number, { name?: string; email?: string }> = {}
          data.users.forEach((u: any) => {
            map[Number(u.id)] = { name: (u.name || u.email || '').trim() || u.email, email: u.email }
          })
          if (!cancelled) setUsersMap(map)
        }
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return
    if (isDialogOpen) return
    // Don't start scrolling if clicking on a draggable task card or in edit mode
    const target = e.target as HTMLElement
    const taskCard = target.closest('[draggable="true"]')
    if (taskCard || isEditMode || isDialogOpen) return
    
    setIsScrolling(true)
    setScrollStart(e.clientX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScrolling || !scrollContainerRef.current || isEditMode || isDialogOpen) return
    
    e.preventDefault()
    const x = e.clientX - scrollContainerRef.current.offsetLeft
    const walk = (x - scrollStart) * 2 // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeft - walk
  }

  const handleMouseUp = () => {
    setIsScrolling(false)
  }

  const handleMouseLeave = () => {
    setIsScrolling(false)
  }

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setIsDialogOpen(true)
  }

  // Listen for custom event to open task from URL parameter
  React.useEffect(() => {
    const handleOpenTask = (event: CustomEvent) => {
      const task = event.detail
      if (task) {
        setSelectedTask(task)
        setIsDialogOpen(true)
      }
    }

    window.addEventListener('openTask', handleOpenTask as EventListener)
    return () => {
      window.removeEventListener('openTask', handleOpenTask as EventListener)
    }
  }, [])

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setSelectedTask(null)
  }

  const handleTaskUpdate = (taskId: string, updates: Partial<Task>) => {
    // Update the task in the parent component
    onTaskUpdate(taskId, updates)
    
    // Update the selected task for the dialog
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, ...updates })
    }
  }

  const handleTaskDelete = (taskId: string) => {
    if (onTaskDelete) {
      onTaskDelete(taskId)
    } else {
      // Soft-delete fallback
      onTaskUpdate(taskId, { status: "deleted" })
      if (selectedTask && selectedTask.id === taskId) {
        setSelectedTask({ ...selectedTask, status: "deleted" })
      }
    }
  }

  const handleColumnDragStart = (e: React.DragEvent, columnId: string) => {
    e.dataTransfer.setData("columnId", columnId)
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleColumnDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    const draggedColumnId = e.dataTransfer.getData("columnId")
    
    if (draggedColumnId && draggedColumnId !== targetColumnId) {
      const draggedIndex = localColumns.findIndex(col => col.id === draggedColumnId)
      const targetIndex = localColumns.findIndex(col => col.id === targetColumnId)
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newColumns = [...localColumns]
        const [draggedColumn] = newColumns.splice(draggedIndex, 1)
        newColumns.splice(targetIndex, 0, draggedColumn)
        
        setLocalColumns(newColumns)
        onColumnsReorder?.(newColumns)
      }
    }
  }

  const handleColumnRename = (columnId: string, newTitle: string) => {
    const updatedColumns = localColumns.map(col => 
      col.id === columnId ? { ...col, title: newTitle } : col
    )
    setLocalColumns(updatedColumns)
    onColumnsReorder?.(updatedColumns)
  }

  const handleTaskRename = (taskId: string, newTitle: string) => {
    // Update the task in the parent component
    onTaskUpdate(taskId, { title: newTitle })
    
    // Update the selected task for the dialog
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, title: newTitle })
    }
  }

  return (
    <div 
      className="h-full w-full p-4 pt-0 overflow-x-auto kanban-hscrollbar"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      ref={scrollContainerRef}
      style={{ cursor: (isEditMode || isDialogOpen) ? 'default' : (isScrolling ? 'grabbing' : 'grab') }}
    >
      <div
        className="origin-top-left"
        style={{
          transform: `scale(${zoomScale})`,
          width: zoomWrapperWidth,
        }}
      >
      <Reorder.Group 
        axis="x" 
        values={localColumns} 
        onReorder={(newColumns) => {
          const uniq = uniqueColumns(newColumns)
          setLocalColumns(uniq)
          onColumnsReorder?.(uniq)
        }}
        className={`flex gap-4 h-full min-w-max ${isEditMode ? 'overflow-visible cursor-grab active:cursor-grabbing' : 'overflow-hidden'}`}
        style={{ 
          position: 'relative',
          width: 'max-content'
        }}
        onDragOver={(e: React.DragEvent) => {
          if (!isEditMode) return
          
          const container = e.currentTarget
          const rect = container.getBoundingClientRect()
          const x = e.clientX - rect.left
          
          // Calculate drop position based on column width and gap
          const columnWidth = 320
          const gap = 16 // gap-4 = 16px
          const totalWidth = columnWidth + gap
          
          let dropPosition = Math.floor(x / totalWidth)
          dropPosition = Math.max(0, Math.min(dropPosition, localColumns.length))
          
          setColumnDropPosition(dropPosition)
          setIsColumnDragOver(true)
        }}
        onDragLeave={() => {
          if (isEditMode) {
            setIsColumnDragOver(false)
            setColumnDropPosition(null)
          }
        }}
      >
        <AnimatePresence mode="popLayout">
          {uniqueColumns(localColumns).map((column, index) => (
            <div key={`col-${column.id}`} className="relative">
              {/* Column drop indicator */}
              {isEditMode && isColumnDragOver && columnDropPosition === index && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 4 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="absolute left-0 right-0 bg-blue-500 rounded-full z-10"
                  style={{ 
                    height: '4px',
                    top: '-2px'
                  }}
                />
              )}
              
              <Reorder.Item
                value={column}
                whileDrag={{ 
                  zIndex: 50,
                  boxShadow: "0 2px 8px -2px rgba(0, 0, 0, 0.05)",
                  transition: { 
                    duration: 0.1,
                    ease: "easeOut"
                  }
                }}
                drag={isEditMode}
                onDragStart={() => {
                  if (isEditMode) {
                    setIsColumnDragOver(true)
                  }
                }}
                onDragEnd={() => {
                  if (isEditMode) {
                    setIsColumnDragOver(false)
                    setColumnDropPosition(null)
                  }
                }}
                style={{ 
                  position: 'relative',
                  width: '320px',
                  height: '100%',
                  flexShrink: 0
                }}
              >
                <KanbanColumn
                  column={column}
                  tasks={activeTasks}
                  onTaskMove={onTaskMove}
                  onTaskClick={handleTaskClick}
                  onTaskCreate={onTaskCreate}
                  isEditMode={isEditMode}
                  onTaskDelete={handleTaskDelete}
                  onTaskRename={handleTaskRename}
                  availableGroups={localColumns.map(col => ({ id: col.id, title: col.title }))}
                  usersMap={usersMap}
                />
              </Reorder.Item>
            </div>
          ))}
          
          {/* Drop indicator at the end */}
          {isEditMode && isColumnDragOver && columnDropPosition === localColumns.length && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 4 }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-blue-500 rounded-full z-10"
              style={{ 
                height: '4px',
                width: '320px',
                flexShrink: 0
              }}
            />
          )}
        </AnimatePresence>
      </Reorder.Group>
      </div>
      
      <TaskDetailDialog
        task={selectedTask}
        tasks={activeTasks}
        columns={localColumns}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onTaskUpdate={handleTaskUpdate}
        onOpenTask={(openTaskId) => {
          const next = activeTasks.find(t => t.id === String(openTaskId))
          if (next) {
            setSelectedTask(next)
            setIsDialogOpen(true)
          }
        }}
      />
    </div>
  )
} 


