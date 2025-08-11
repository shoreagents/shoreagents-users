"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
  MoreHorizontal, 
  Plus, 
  Flag, 
  Calendar, 
  GripVertical,
  ChevronRight,
  Trash2,
  Edit3,
  ArrowRight,
  CheckCircle,
  Clock,
  ListTodo,
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
}

const TaskCard = ({ 
  task, 
  onMove, 
  onTaskClick,
  isEditMode = false,
  onDelete,
  onRename,
  availableGroups
}: { 
  task: Task; 
  onMove: (newStatus: string) => void;
  onTaskClick: (task: Task) => void;
  isEditMode?: boolean;
  onDelete?: (taskId: string) => void;
  onRename?: (taskId: string, newTitle: string) => void;
  availableGroups?: Array<{id: string, title: string}>;
}) => {
  const [isDragging, setIsDragging] = useState(false)
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
  }

  const handleDragEnd = () => {
    if (isEditMode) return
    setIsDragging(false)
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
    onDelete?.(task.id)
  }

  const handleRename = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDropdownOpen(false) // Close the dropdown menu
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
        <Card className="w-full shadow-none border border-border/50 overflow-hidden">
          {/* Cover Photo */}
          {task.attachments && task.attachments.length > 0 && (
            <div className="relative w-full h-32 bg-muted">
              <img
                src={task.attachments[0].url}
                alt={task.attachments[0].name}
                className="w-full h-full object-cover"
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
              {task.attachments && task.attachments.length > 1 && (
                <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium">
                  +{task.attachments.length - 1}
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
                  className="text-sm font-medium leading-none bg-background border border-input rounded px-2 py-1 focus:ring-2 focus:ring-ring focus:border-ring flex-1 min-w-0"
                  autoFocus
                  onFocus={(e) => e.target.select()}
                />
              ) : (
                <h4 className="text-sm font-medium leading-none truncate">{task.title}</h4>
              )}
              <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild onClick={handleDropdownClick}>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <MoreHorizontal className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleRename}>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger onClick={handleMoveToClick}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Move to
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {availableGroups?.filter(group => group.id !== task.status).map((group) => (
                        <DropdownMenuItem 
                          key={group.id} 
                          onClick={(e) => handleMoveTask(e, group.id)}
                        >
                          {group.title}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
              {task.description}
            </p>
            
            {/* Tags */}
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {task.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            
            {/* Footer */}
            <div className="flex items-center justify-between min-w-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Priority */}
                <div className="flex items-center gap-1 min-w-0">
                  <Flag className={cn("h-3 w-3 flex-shrink-0", priorityColors[task.priority])} />
                  <span className="text-xs capitalize truncate">{task.priority}</span>
                </div>
                
                {/* Due Date */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{new Date(task.dueDate).toLocaleDateString()}</span>
                </div>

                {/* Attachments */}
                {task.attachments && task.attachments.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    <span>{task.attachments.length}</span>
                  </div>
                )}
              </div>
              
              {/* Assignee */}
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {getInitials(task.assignee)}
                </AvatarFallback>
              </Avatar>
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
  availableGroups
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
      for (let i = 0; i < taskElements.length; i++) {
        const taskElement = taskElements[i] as HTMLElement
        const taskRect = taskElement.getBoundingClientRect()
        const taskTop = taskRect.top - dropRect.top
        const taskBottom = taskRect.bottom - dropRect.top
        const taskCenter = (taskTop + taskBottom) / 2
        
        if (dropY < taskCenter) {
          targetPosition = i + 1
          break
        }
        targetPosition = i + 2
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
      // Calculate target position based on drop location
      const dropZone = e.currentTarget as HTMLElement
      const dropRect = dropZone.getBoundingClientRect()
      const dropY = e.clientY - dropRect.top
      
      // Find the target position based on drop location
      const taskElements = dropZone.querySelectorAll('[data-task-id]')
      let targetPosition = 1 // Default to first position
      
      console.log(`Drop Y: ${dropY}, Task elements: ${taskElements.length}`)
      
      // If no tasks in the column, position will be 1
      if (taskElements.length === 0) {
        targetPosition = 1
        console.log('No tasks in column, setting position to 1')
      } else {
        // Check each task element to find the correct insertion point
        for (let i = 0; i < taskElements.length; i++) {
          const taskElement = taskElements[i] as HTMLElement
          const taskRect = taskElement.getBoundingClientRect()
          const taskTop = taskRect.top - dropRect.top
          const taskBottom = taskRect.bottom - dropRect.top
          const taskCenter = (taskTop + taskBottom) / 2
          
          console.log(`Task ${i + 1}: top=${taskTop}, bottom=${taskBottom}, center=${taskCenter}`)
          
          // If drop is above the middle of this task, insert before it
          if (dropY < taskCenter) {
            targetPosition = i + 1
            console.log(`Drop above task ${i + 1}, setting position to ${targetPosition}`)
            break
          }
          // If drop is below this task, continue to next task
          targetPosition = i + 2
          console.log(`Drop below task ${i + 1}, continuing...`)
        }
      }
      
      console.log(`Dropping task ${taskId} at position ${targetPosition} in column ${column.id}`)
      console.log('Current tasks in column:', columnTasks.map(t => ({ id: t.id, title: t.title })))
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
        scale: 1.03,
        rotate: 1,
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
          <Badge variant="secondary" className="text-xs">
            {columnTasks.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAddTask}
            className="h-6 w-6 p-0 hover:bg-background/80"
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
          "flex-1 overflow-y-auto overflow-x-hidden transition-colors rounded-md",
          isDragOver && "bg-primary/10 border-2 border-dashed border-primary"
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
              {/* Drop indicator */}
              {isDragOver && dropPosition === index + 1 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 4 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-primary rounded-full my-1"
                  style={{ height: '4px' }}
                />
              )}
              <TaskCard
                task={task}
                onMove={(newStatus) => onTaskMove(task.id, newStatus)}
                onTaskClick={onTaskClick}
                isEditMode={isEditMode}
                onDelete={onTaskDelete} // Pass onDelete to TaskCard
                onRename={onTaskRename} // Pass onRename to TaskCard
                availableGroups={availableGroups}
              />
            </motion.div>
          ))}
          {/* Drop indicator at the end */}
          {isDragOver && dropPosition === columnTasks.length + 1 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 4 }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-primary rounded-full my-1"
              style={{ height: '4px' }}
            />
          )}
        </AnimatePresence>
        
        {columnTasks.length === 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center h-32 text-muted-foreground text-sm"
          >
            {isDragOver ? "Drop task here" : "No tasks"}
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
        >
          <Plus className="h-3 w-3 mr-2" />
          Add Task
        </Button>
      </div>
    </motion.div>
  )
}

export function KanbanBoard({ tasks, columns, onTaskMove, onTaskCreate, onTaskUpdate, onTaskRename, onColumnsReorder, isEditMode = false }: KanbanBoardProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [localColumns, setLocalColumns] = useState(columns)
  const [isScrolling, setIsScrolling] = useState(false)
  const [scrollStart, setScrollStart] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  
  // Column reordering state
  const [isColumnDragOver, setIsColumnDragOver] = useState(false)
  const [columnDropPosition, setColumnDropPosition] = useState<number | null>(null)

  // Filter out deleted tasks
  const activeTasks = tasks.filter(task => task.status !== "deleted")

  // Update localColumns when columns prop changes (e.g., when new groups are added)
  React.useEffect(() => {
    setLocalColumns(columns)
  }, [columns])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return
    
    // Don't start scrolling if clicking on a draggable task card or in edit mode
    const target = e.target as HTMLElement
    const taskCard = target.closest('[draggable="true"]')
    if (taskCard || isEditMode) return
    
    setIsScrolling(true)
    setScrollStart(e.clientX - scrollContainerRef.current.offsetLeft)
    setScrollLeft(scrollContainerRef.current.scrollLeft)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isScrolling || !scrollContainerRef.current || isEditMode) return
    
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
    // Update the task in the parent component
    onTaskUpdate(taskId, { status: "deleted" })
    
    // Update the selected task for the dialog
    if (selectedTask && selectedTask.id === taskId) {
      setSelectedTask({ ...selectedTask, status: "deleted" })
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
      className="h-full w-full p-4 pt-0 overflow-x-auto"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      ref={scrollContainerRef}
      style={{ cursor: isEditMode ? 'default' : (isScrolling ? 'grabbing' : 'grab') }}
    >
      <Reorder.Group 
        axis="x" 
        values={localColumns} 
        onReorder={(newColumns) => {
          setLocalColumns(newColumns)
          onColumnsReorder?.(newColumns)
        }}
        className={`flex gap-4 h-full min-w-max overflow-hidden ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
          {localColumns.map((column, index) => (
            <div key={column.id} className="relative">
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
                  scale: 1.01,
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
      
      <TaskDetailDialog
        task={selectedTask}
        tasks={activeTasks}
        columns={localColumns}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  )
} 