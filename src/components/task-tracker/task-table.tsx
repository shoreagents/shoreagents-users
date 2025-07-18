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
import { Trash2 } from "lucide-react"
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

interface TaskTableProps {
  tasks: Task[]
  onTaskUpdate: (updatedTask: Task) => void
  onTaskDelete: (taskId: string) => void
}

export function TaskTable({ tasks, onTaskUpdate, onTaskDelete }: TaskTableProps) {
  const [availableStatuses] = useState(() => getAvailableStatuses())
  const [availableTaskTypes] = useState(() => getAvailableTaskTypes())
  const [currentPage, setCurrentPage] = useState(1)
  const tasksPerPage = 4

  // Calculate pagination
  const totalPages = Math.ceil(tasks.length / tasksPerPage)
  const startIndex = (currentPage - 1) * tasksPerPage
  const endIndex = startIndex + tasksPerPage
  const currentTasks = tasks.slice(startIndex, endIndex)

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
    if (window.confirm('Are you sure you want to delete this task?')) {
      const success = deleteTask(taskId)
      if (success) {
        onTaskDelete(taskId)
        // Adjust current page if we deleted the last item on a page
        const newTotalPages = Math.ceil((tasks.length - 1) / tasksPerPage)
        if (currentPage > newTotalPages && newTotalPages > 0) {
          setCurrentPage(newTotalPages)
        }
      }
    }
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

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, HH:mm")
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
              
              <div className="grid grid-cols-2 gap-3">
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
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Last edited by</div>
                  <div className="text-xs font-medium">{task.lastEditedBy}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(task.lastEditedTime)}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table Layout (hidden on mobile) */}
      <div className="hidden lg:block">
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[150px] min-w-[150px]">Task Name</TableHead>
                <TableHead className="w-[100px] min-w-[100px]">Status</TableHead>
                <TableHead className="w-[120px] min-w-[120px]">Assignee</TableHead>
                <TableHead className="w-[100px] min-w-[100px]">Due Date</TableHead>
                <TableHead className="w-[80px] min-w-[80px]">Priority</TableHead>
                <TableHead className="w-[120px] min-w-[120px]">Task Type</TableHead>
                <TableHead className="w-[180px] min-w-[180px]">Description</TableHead>
                <TableHead className="w-[80px] min-w-[80px]">Files</TableHead>
                <TableHead className="w-[100px] min-w-[100px]">Created By</TableHead>
                <TableHead className="w-[120px] min-w-[120px]">Created Time</TableHead>
                <TableHead className="w-[100px] min-w-[100px]">Last Edited By</TableHead>
                <TableHead className="w-[120px] min-w-[120px]">Last Edited Time</TableHead>
                <TableHead className="w-[50px] min-w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentTasks.map((task) => (
                <TableRow key={task.id} className="hover:bg-muted/50">
                  <TableCell className="max-w-0 pr-2">
                    <div className="truncate">
                      <InlineEditText
                        value={task.taskName}
                        onSave={(value) => handleTaskUpdate(task.id, 'taskName', value)}
                        placeholder="Enter task name"
                        className="w-full"
                      />
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
                  
                  <TableCell className="max-w-0 px-1">
                    <div className="truncate">
                      <InlineEditText
                        value={task.description}
                        onSave={(value) => handleTaskUpdate(task.id, 'description', value)}
                        placeholder="Add description"
                        multiline
                        className="w-full"
                      />
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-1">
                    <InlineEditFiles
                      value={task.attachedFiles}
                      onSave={(value) => handleTaskUpdate(task.id, 'attachedFiles', value)}
                    />
                  </TableCell>
                  
                  <TableCell className="max-w-0 px-1">
                    <div className="truncate text-sm">
                      {task.createdBy}
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-1">
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(task.createdTime)}
                    </div>
                  </TableCell>
                  
                  <TableCell className="max-w-0 px-1">
                    <div className="truncate text-sm">
                      {task.lastEditedBy}
                    </div>
                  </TableCell>
                  
                  <TableCell className="px-1">
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(task.lastEditedTime)}
                    </div>
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
              ))}
            </TableBody>
          </Table>
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
                      className="cursor-pointer"
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
    </div>
  )
} 