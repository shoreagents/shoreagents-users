// Updated Task types to match database schema
export type TaskStatus = string // Dynamic user-defined statuses
export type TaskPriority = 'low' | 'medium' | 'high' // Database uses lowercase
export type TaskType = string // Dynamic user-defined task types

export interface Task {
  id: string
  task_id?: string // Database ID field
  taskName: string
  status: TaskStatus
  status_name?: string // Database field name
  status_color?: string // Database field for UI colors
  is_completed?: boolean // Database field indicating if status means done
  assignee: string
  dueDate: string | null
  due_date?: string | null // Database field name
  priority: TaskPriority
  taskType: TaskType
  type_name?: string // Database field name
  type_color?: string // Database field for UI colors
  description: string
  attachedFiles: string[]
  files?: string[] // Database field name
  createdBy: string
  created_by?: string // Database field name
  createdTime: string
  created_at?: string // Database field name
  lastEditedBy: string
  last_edited_by?: string // Database field name
  lastEditedTime: string
  updated_at?: string // Database field name
  user_id?: number // Database field
}

// Keep the TaskData interface for backward compatibility, but it's no longer used with localStorage
export interface TaskData {
  tasks: Task[]
  customStatuses: string[]
  customTaskTypes: string[]
} 