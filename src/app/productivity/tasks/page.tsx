"use client"

import { useState, useEffect } from "react"
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

  useEffect(() => {
    loadTasksWithLoading()
  }, [])

  const loadTasks = () => {
    const allTasks = getAllTasks()
    setTasks(allTasks)
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
    setTasks(currentTasks => [...currentTasks, newTask])
  }

  const loadTasksWithLoading = () => {
    setLoading(true)
    // Simulate loading delay only for initial load
    setTimeout(() => {
      const allTasks = getAllTasks()
      setTasks(allTasks)
      setLoading(false)
    }, 500)
  }

  const handleCreateTask = () => {
    const newTask = createTask({
      taskName: "New Task",
      status: "Not started",
      priority: "Medium",
      taskType: "Document"
    })
    handleTaskCreate(newTask)
  }

  const getStatusCount = (status: string) => {
    return tasks.filter(task => task.status === status).length
  }

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         task.assignee.toLowerCase().includes(searchTerm.toLowerCase())
    
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Task Tracker</h1>
                <p className="text-muted-foreground">Loading your tasks...</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                    <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 w-12 bg-muted animate-pulse rounded mb-1" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Loading tasks...</p>
                  </div>
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
            <Button onClick={handleCreateTask} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                <CheckSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{tasks.length}</div>
                <p className="text-xs text-muted-foreground">
                  All tasks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Not Started</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{getStatusCount('Not started')}</div>
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
                <div className="text-2xl font-bold">{getStatusCount('In progress')}</div>
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
          </div>

          {/* Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-lg">Filters</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statusFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("all")}
                    className="text-xs"
                  >
                    All ({tasks.length})
                  </Button>
                  <Button
                    variant={statusFilter === "Not started" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Not started")}
                    className="text-xs"
                  >
                    Not Started ({getStatusCount('Not started')})
                  </Button>
                  <Button
                    variant={statusFilter === "In progress" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("In progress")}
                    className="text-xs"
                  >
                    In Progress ({getStatusCount('In progress')})
                  </Button>
                  <Button
                    variant={statusFilter === "Done" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter("Done")}
                    className="text-xs"
                  >
                    Done ({getStatusCount('Done')})
                  </Button>
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
              />
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 