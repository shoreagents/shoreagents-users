export type TaskStatus = 'Not started' | 'In progress' | 'Done'
export type TaskPriority = 'Low' | 'Medium' | 'High'
export type TaskType = 'Document' | 'Bug' | 'Feature Request' | 'Polish'

export interface Task {
  id: string
  taskName: string
  status: TaskStatus
  assignee: string
  dueDate: string
  priority: TaskPriority
  taskType: TaskType
  description: string
  attachedFiles: string[]
  createdBy: string
  createdTime: string
  lastEditedBy: string
  lastEditedTime: string
}

export interface TaskData {
  tasks: Task[]
  customStatuses: string[]
  customTaskTypes: string[]
} 