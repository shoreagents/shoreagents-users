"use client"

import { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KanbanBoard } from "@/components/task-activity-components/kanban-board"
import { Button } from "@/components/ui/button"
import { Plus, Filter, Users, Calendar, Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Mock task data for frontend-only implementation
const mockTasks = [
  {
    id: "task-1",
    title: "Design landing page wireframes",
    description: "Create initial wireframes for the new landing page redesign",
    priority: "urgent" as const,
    assignee: "John Doe",
    dueDate: "2025-01-30",
    tags: ["design", "wireframe"],
    status: "todo",
    relationships: [
      { taskId: "task-2", type: "blocks" }
    ]
  },
  {
    id: "task-2", 
    title: "Implement user authentication",
    description: "Set up login/logout functionality with JWT tokens",
    priority: "high" as const,
    assignee: "Jane Smith",
    dueDate: "2025-01-28",
    tags: ["backend", "auth"],
    status: "in-progress",
    relationships: [
      { taskId: "task-3", type: "depends_on" }
    ]
  },
  {
    id: "task-3",
    title: "Write API documentation",
    description: "Document all REST API endpoints with examples",
    priority: "normal" as const,
    assignee: "Bob Johnson",
    dueDate: "2025-02-05",
    tags: ["documentation"],
    status: "review",
    relationships: []
  },
  {
    id: "task-4",
    title: "Setup production deployment",
    description: "Configure CI/CD pipeline for production environment",
    priority: "low" as const,
    assignee: "Alice Wilson",
    dueDate: "2025-02-10",
    tags: ["devops", "deployment"],
    status: "done",
    relationships: []
  },
  {
    id: "task-5",
    title: "User testing session",
    description: "Conduct usability testing with 5 target users",
    priority: "normal" as const,
    assignee: "John Doe",
    dueDate: "2025-02-01",
    tags: ["testing", "ux"],
    status: "todo",
    relationships: [
      { taskId: "task-6", type: "related_to" }
    ]
  },
  {
    id: "task-6",
    title: "Mobile responsive fixes",
    description: "Fix layout issues on mobile devices",
    priority: "high" as const,
    assignee: "Jane Smith", 
    dueDate: "2025-01-29",
    tags: ["frontend", "mobile"],
    status: "in-progress",
    relationships: []
  }
]

// Default columns
const defaultColumns = [
  { id: "todo", title: "To Do", color: "bg-gray-100 dark:bg-gray-800" },
  { id: "in-progress", title: "In Progress", color: "bg-blue-50 dark:bg-blue-950/20" },
  { id: "review", title: "Review", color: "bg-yellow-50 dark:bg-yellow-950/20" },
  { id: "done", title: "Done", color: "bg-green-50 dark:bg-green-950/20" }
]

export default function TaskActivityPage() {
  const [tasks, setTasks] = useState(mockTasks)
  const [columns, setColumns] = useState(defaultColumns)
  const [isAddGroupOpen, setIsAddGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [isEditMode, setIsEditMode] = useState(false)

  const handleTaskMove = (taskId: string, newStatus: string) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    )
  }

  const handleTaskCreate = (status: string) => {
    const newTask = {
      id: `task-${Date.now()}`,
      title: "New Task",
      description: "Task description",
      priority: "normal" as const,
      assignee: "Unassigned",
      dueDate: new Date().toISOString().split('T')[0],
      tags: [],
      status: status,
      relationships: []
    }
    setTasks(prev => [...prev, newTask])
  }

  const handleTaskUpdate = (taskId: string, updates: Partial<any>) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task.id === taskId ? { ...task, ...updates } : task
      )
    )
  }

  const handleColumnsReorder = (newColumns: any[]) => {
    setColumns(newColumns)
  }

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode)
  }

  const handleAddGroup = () => {
    if (newGroupName.trim()) {
      const newColumn = {
        id: newGroupName.toLowerCase().replace(/\s+/g, '-'),
        title: newGroupName,
        color: "bg-purple-50 dark:bg-purple-950/20"
      }
      setColumns(prev => [...prev, newColumn])
      setNewGroupName("")
      setIsAddGroupOpen(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 h-screen overflow-hidden max-w-full">
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0 min-w-0">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">Task Activity</h1>
              <p className="text-muted-foreground">
                Manage your tasks with drag and drop Kanban boards
              </p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>All Tasks</DropdownMenuItem>
                  <DropdownMenuItem>My Tasks</DropdownMenuItem>
                  <DropdownMenuItem>High Priority</DropdownMenuItem>
                  <DropdownMenuItem>Due Today</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Assignee
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>All Assignees</DropdownMenuItem>
                  <DropdownMenuItem>John Doe</DropdownMenuItem>
                  <DropdownMenuItem>Jane Smith</DropdownMenuItem>
                  <DropdownMenuItem>Bob Johnson</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Due Date
              </Button>

              <Button
                variant={isEditMode ? "default" : "outline"}
                size="sm"
                onClick={toggleEditMode}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {isEditMode ? "Exit Edit Mode" : "Edit Board"}
              </Button>

              <Dialog open={isAddGroupOpen} onOpenChange={setIsAddGroupOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Group</DialogTitle>
                    <DialogDescription>
                      Add a new group to organize your tasks.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="group-name" className="text-right">
                        Name
                      </Label>
                      <Input
                        id="group-name"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="e.g., On Hold"
                        className="col-span-3"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddGroup()
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddGroupOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddGroup}>Add Group</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Kanban Board Card */}
          <Card className="flex-1 flex flex-col min-h-0 min-w-0">
            <CardHeader className="flex-shrink-0 pb-3">
              <CardTitle className="text-lg">Board View</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-x-auto overflow-y-hidden">
              <KanbanBoard 
                tasks={tasks} 
                columns={columns}
                onTaskMove={handleTaskMove}
                onTaskCreate={handleTaskCreate}
                onTaskUpdate={handleTaskUpdate}
                onColumnsReorder={handleColumnsReorder}
                isEditMode={isEditMode}
              />
            </CardContent>
          </Card>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 