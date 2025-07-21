"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Trash2, ChevronDown, ChevronRight, Info, User, Clock, FileText } from "lucide-react"
import { Task } from "@/types/task"
import { 
  updateTask, 
  deleteTask, 
  addCustomStatus, 
  addCustomTaskType,
  getAvailableStatuses,
  getAvailableTaskTypes
} from "@/lib/task-utils"
import { InlineEditText } from "./inline-edit-text"
import { InlineEditSelect } from "./inline-edit-select"
import { InlineEditDate } from "./inline-edit-date"
import { InlineEditFiles } from "./inline-edit-files"
import { Card, CardContent } from "@/components/ui/card"
import React from "react"

interface TaskTableProps {
  tasks: Task[]
  onTaskUpdate: (updatedTask: Task) => void
  onTaskDelete: (taskId: string) => void
}

export function TaskTable({ tasks, onTaskUpdate, onTaskDelete }: TaskTableProps) {
  const [availableStatuses] = useState(() => getAvailableStatuses())
  const [availableTaskTypes] = useState(() => getAvailableTaskTypes())
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
  const [isShaking, setIsShaking] = useState(false)
  const tasksPerPage = 4

  // Calculate pagination
  const totalPages = Math.ceil(tasks.length / tasksPerPage)
  const startIndex = (currentPage - 1) * tasksPerPage
  const endIndex = startIndex + tasksPerPage
  const currentTasks = tasks.slice(startIndex, endIndex)

  // Auto-expand first row to show users the feature exists (only once)
  useEffect(() => {
    if (currentTasks.length > 0 && !hasAutoExpanded) {
      setExpandedRows(new Set([currentTasks[0].id]))
      setHasAutoExpanded(true)
    }
  }, [currentTasks, hasAutoExpanded])

  // Reset to first page when tasks change and current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [tasks.length, currentPage, totalPages])

  const handleTaskUpdate = (taskId: string, field: keyof Task, value: any) => {
    const updatedTask = updateTask(taskId, { [field]: value })
    if (updatedTask) {
      onTaskUpdate(updatedTask)
    }
  }

  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      const success = deleteTask(taskToDelete)
      if (success) {
        onTaskDelete(taskToDelete)
        // Adjust current page if we deleted the last item on a page
        const newTotalPages = Math.ceil((tasks.length - 1) / tasksPerPage)
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages)
        }
      }
    }
    setDeleteDialogOpen(false)
    setTaskToDelete(null)
  }

  const cancelDeleteTask = () => {
    setDeleteDialogOpen(false)
    setTaskToDelete(null)
    setIsShaking(false)
  }

  const handleOutsideClick = (e: Event) => {
    e.preventDefault()
    // Trigger shake animation
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 600) // Reset after animation
  }

  const handleAddCustomStatus = (status: string) => {
    addCustomStatus(status)
    // We still need to reload tasks when adding custom options
    // since this affects the available options
  }

  const handleAddCustomTaskType = (taskType: string) => {
    addCustomTaskType(taskType)
    // We still need to reload tasks when adding custom options
    // since this affects the available options
  }

  const toggleRowExpansion = (taskId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedRows(newExpanded)
  }

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy HH:mm")
    } catch {
      return dateString
    }
  }

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = []
    const maxVisiblePages = 5

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        pages.push(1)
        pages.push('ellipsis')
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)
        pages.push('ellipsis')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('ellipsis')
        pages.push(totalPages)
      }
    }

    return pages
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg mb-2">No tasks yet</p>
        <p className="text-sm">Create your first task to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card Layout (hidden on desktop) */}
      <div className="lg:hidden space-y-4">
        {currentTasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <InlineEditText
                  value={task.taskName}
                  onSave={(value) => handleTaskUpdate(task.id, 'taskName', value)}
                  placeholder="Enter task name"
                  className="font-medium flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteTask(task.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive ml-2"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
                  <InlineEditSelect
                    value={task.status}
                    options={availableStatuses}
                    onSave={(value) => handleTaskUpdate(task.id, 'status', value)}
                    onAddOption={handleAddCustomStatus}
                    variant="status"
                    placeholder="Set status"
                  />
                </div>
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Priority</div>
                  <InlineEditSelect
                    value={task.priority}
                    options={['Low', 'Medium', 'High']}
                    onSave={(value) => handleTaskUpdate(task.id, 'priority', value)}
                    variant="priority"
                    placeholder="Set priority"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Assignee</div>
                  <InlineEditText
                    value={task.assignee}
                    onSave={(value) => handleTaskUpdate(task.id, 'assignee', value)}
                    placeholder="Assign to"
                    className="w-full"
                  />
                </div>
                
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Due Date</div>
                  <InlineEditDate
                    value={task.dueDate}
                    onSave={(value) => handleTaskUpdate(task.id, 'dueDate', value)}
                    placeholder="Set due date"
                  />
                </div>
              </div>
              
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Task Type</div>
                <InlineEditSelect
                  value={task.taskType}
                  options={availableTaskTypes}
                  onSave={(value) => handleTaskUpdate(task.id, 'taskType', value)}
                  onAddOption={handleAddCustomTaskType}
                  variant="taskType"
                  placeholder="Set type"
                />
              </div>
              
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Description</div>
                <InlineEditText
                  value={task.description}
                  onSave={(value) => handleTaskUpdate(task.id, 'description', value)}
                  placeholder="Add description"
                  multiline
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Files</div>
                  <InlineEditFiles
                    value={task.attachedFiles}
                    onSave={(value) => handleTaskUpdate(task.id, 'attachedFiles', value)}
                  />
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Created by</div>
                  <div className="text-xs font-medium">{task.createdBy}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(task.createdTime)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table Layout (hidden on mobile) */}
      <div className="hidden lg:block">
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 md:px-6">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px]">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center justify-center cursor-help">
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Click arrows to expand task details</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableHead>
                    <TableHead className="w-[28%]">Task Name</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="w-[15%]">Assignee</TableHead>
                    <TableHead className="w-[12%]">Due Date</TableHead>
                    <TableHead className="w-[10%]">Priority</TableHead>
                    <TableHead className="w-[13%]">Task Type</TableHead>
                    <TableHead className="w-[8%] hidden xl:table-cell">Files</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentTasks.map((task) => (
                    <React.Fragment key={task.id}>
                      <TableRow className="hover:bg-muted/50">
                        <TableCell className="p-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleRowExpansion(task.id)}
                                className="h-6 w-6 p-0 hover:bg-primary/10 transition-colors"
                              >
                                {expandedRows.has(task.id) ? (
                                  <ChevronDown className="h-3 w-3 text-primary" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <p className="text-xs">
                                {expandedRows.has(task.id) ? 'Hide details' : 'Show description, files & audit trail'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>

                        <TableCell className="max-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <div className="truncate flex-1">
                              <InlineEditText
                                value={task.taskName}
                                onSave={(value) => handleTaskUpdate(task.id, 'taskName', value)}
                                placeholder="Enter task name"
                                className="w-full"
                              />
                            </div>
                            {task.description && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm p-3">
                                  <p className="text-xs whitespace-pre-wrap break-words">
                                    {task.description.length > 100 
                                      ? `${task.description.substring(0, 100)}...` 
                                      : task.description
                                    }
                                  </p>
                                  {task.description.length > 100 && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                      Click to expand for full description
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell className="px-1">
                          <InlineEditSelect
                            value={task.status}
                            options={availableStatuses}
                            onSave={(value) => handleTaskUpdate(task.id, 'status', value)}
                            onAddOption={handleAddCustomStatus}
                            variant="status"
                            placeholder="Set status"
                          />
                        </TableCell>
                        
                        <TableCell className="max-w-0 px-1">
                          <div className="truncate">
                            <InlineEditText
                              value={task.assignee}
                              onSave={(value) => handleTaskUpdate(task.id, 'assignee', value)}
                              placeholder="Assign to"
                              className="w-full"
                            />
                          </div>
                        </TableCell>
                        
                        <TableCell className="px-1">
                          <InlineEditDate
                            value={task.dueDate}
                            onSave={(value) => handleTaskUpdate(task.id, 'dueDate', value)}
                            placeholder="Set due date"
                          />
                        </TableCell>
                        
                        <TableCell className="px-1">
                          <InlineEditSelect
                            value={task.priority}
                            options={['Low', 'Medium', 'High']}
                            onSave={(value) => handleTaskUpdate(task.id, 'priority', value)}
                            variant="priority"
                            placeholder="Set priority"
                          />
                        </TableCell>
                        
                        <TableCell className="px-1">
                          <InlineEditSelect
                            value={task.taskType}
                            options={availableTaskTypes}
                            onSave={(value) => handleTaskUpdate(task.id, 'taskType', value)}
                            onAddOption={handleAddCustomTaskType}
                            variant="taskType"
                            placeholder="Set type"
                          />
                        </TableCell>
                        
                        <TableCell className="hidden xl:table-cell px-1">
                          <InlineEditFiles
                            value={task.attachedFiles}
                            onSave={(value) => handleTaskUpdate(task.id, 'attachedFiles', value)}
                          />
                        </TableCell>
                        
                        <TableCell className="pl-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTask(task.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expandable Row Details */}
                      {expandedRows.has(task.id) && (
                        <TableRow>
                          <TableCell colSpan={9} className="p-0 bg-muted/25">
                            <div className="p-4 space-y-4">
                              <div className="grid gap-4 md:grid-cols-2">
                                {/* Description */}
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Description</span>
                                  </div>
                                  <div className="w-full">
                                    <InlineEditText
                                      value={task.description}
                                      onSave={(value) => handleTaskUpdate(task.id, 'description', value)}
                                      placeholder="Add description"
                                      multiline
                                      className="w-full min-h-[3rem] max-w-none"
                                    />
                                  </div>
                                </div>

                                {/* Files (on smaller screens) */}
                                <div className="xl:hidden">
                                  <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Files</span>
                                  </div>
                                  <InlineEditFiles
                                    value={task.attachedFiles}
                                    onSave={(value) => handleTaskUpdate(task.id, 'attachedFiles', value)}
                                  />
                                </div>
                              </div>

                              {/* Audit Trail */}
                              <div className="border-t pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">Audit Trail</span>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3" />
                                    <span>Created by {task.createdBy}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    <span>Created {formatDateTime(task.createdTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <User className="h-3 w-3" />
                                    <span>Last edited by {task.lastEditedBy}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3" />
                                    <span>Last edited {formatDateTime(task.lastEditedTime)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {tasks.length >= 4 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {startIndex + 1}-{Math.min(endIndex, tasks.length)} of {tasks.length} tasks
          </div>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === 'ellipsis' ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      onClick={() => setCurrentPage(page as number)}
                      isActive={currentPage === page}
                      className={`cursor-pointer ${
                        currentPage === page 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                          : 'hover:bg-muted'
                      }`}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent 
          className={`animate-in fade-in-0 zoom-in-95 duration-200 ${
            isShaking ? 'animate-bounce border-2 border-red-500 shadow-lg shadow-red-500/50' : ''
          }`}
          onPointerDownOutside={handleOutsideClick}
        >
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelDeleteTask}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteTask}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 