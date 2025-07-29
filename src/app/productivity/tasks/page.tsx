"use client"

import { useState, useEffect, useRef } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  CheckSquare, 
  Clock, 
  AlertCircle, 
  CheckCircle,
  Filter,
  Search
} from "lucide-react"
import { Task } from "@/types/task"
import { getAllTasks, createTask } from "@/lib/task-utils"
import { TaskTable } from "@/components/task-tracker/task-table"

export default function TaskTrackerPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const creatingTaskRef = useRef(false)

  useEffect(() => {
    loadTasksWithLoading()
  }, [])

  const loadTasks = async () => {
    try {
      const allTasks = await getAllTasks()
      setTasks(allTasks)
    } catch (error) {
      console.error('Error loading tasks:', error)
      setTasks([])
    }
  }

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks(currentTasks => 
      currentTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    )
  }

  const handleTaskDelete = (taskId: string) => {
    setTasks(currentTasks => 
      currentTasks.filter(task => task.id !== taskId)
    )
  }

  const handleTaskCreate = (newTask: Task) => {
    setTasks(currentTasks => {
      // Check if task already exists to prevent duplicates
      if (currentTasks.some(task => task.id === newTask.id)) {
        console.warn('Task with ID already exists:', newTask.id)
        return currentTasks
      }
      return [newTask, ...currentTasks] // Add to the beginning for newest first
    })
  }

  const loadTasksWithLoading = async () => {
    setLoading(true)
    try {
      const allTasks = await getAllTasks()
      setTasks(allTasks)
    } catch (error) {
      console.error('Error loading tasks:', error)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = async () => {
    if (isCreatingTask || creatingTaskRef.current) return // Prevent double-clicking
    
    setIsCreatingTask(true)
    creatingTaskRef.current = true
    
    try {
      const newTask = await createTask({
        taskName: "New Task",
        status: "Not Started",
        priority: "medium",
        taskType: "Document"
        // Don't specify assignee - let it default to current agent
      })
      
      if (newTask) {
        handleTaskCreate(newTask)
      }
    } catch (error) {
      console.error('Error creating task:', error)
    } finally {
      // Reset the flags after a short delay to prevent rapid clicking
      setTimeout(() => {
        setIsCreatingTask(false)
        creatingTaskRef.current = false
      }, 500)
    }
  }

  const getStatusCount = (status: string) => {
    if (status === 'Not Started') {
      return tasks.filter(task => task.status === 'Not Started').length
    }
    if (status === 'In Progress') {
      return tasks.filter(task => task.status === 'In Progress').length
    }
    if (status === 'Done') {
      return tasks.filter(task => task.is_completed === true).length
    }
    return tasks.filter(task => task.status === status).length
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = (task.taskName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.assignee || '').toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || task.status === statusFilter

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            <div className="flex flex-col space-y-4">
              <div className="h-8 w-64 bg-muted animate-pulse rounded" />
              <div className="h-4 w-96 bg-muted animate-pulse rounded" />
            </div>
            <div className="grid gap-6 md:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    <div className="h-8 w-16 bg-muted animate-pulse rounded" />
                  </CardHeader>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>
                <div className="h-6 w-32 bg-muted animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Task Tracker</h1>
              <p className="text-muted-foreground">Manage your tasks and projects</p>
            </div>
            <Button 
              onClick={handleCreateTask} 
              disabled={isCreatingTask}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" />
              {isCreatingTask ? "Creating..." : "New Task"}
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Not Started</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('Not Started')}</div>
                <p className="text-xs text-muted-foreground">
                  Pending tasks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('In Progress')}</div>
                <p className="text-xs text-muted-foreground">
                  Active tasks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('Done')}</div>
                <p className="text-xs text-muted-foreground">
                  Finished tasks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tasks.length}</div>
                <p className="text-xs text-muted-foreground">
                  All tasks
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>Find specific tasks quickly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search tasks by name, description, or assignee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded-md px-3 py-2 text-sm bg-background"
                  >
                    <option value="all">All Status</option>
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Table */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Tasks</CardTitle>
                  <CardDescription>
                    {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} 
                    {searchTerm && ` matching "${searchTerm}"`}
                    {statusFilter !== "all" && ` with status "${statusFilter}"`}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="w-fit">
                  {filteredTasks.length} tasks
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="py-0 px-4">
              <TaskTable 
                tasks={filteredTasks} 
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                onRefreshTasks={loadTasks}
              />
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 