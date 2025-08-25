"use client"

import { useState, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  Users,

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
import { toast } from "sonner"
import React from "react"
import { Card } from "@/components/ui/card"
import { Reorder } from "framer-motion"


interface Task {
  id: string
  creator_id?: number
  is_owner?: boolean
  title: string
  description: string
  priority: "urgent" | "high" | "normal" | "low"
  assignee: string
  dueDate: string
  tags: string[]
  status: string
  group_id?: number
  relationships?: Array<{ taskId: string; type: string }>
  custom_fields?: Array<{ id: string; title: string; description: string; position?: number }>
  attachments?: Array<{ id: string; name: string; url: string; type: string }>
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
  onOpenTask?: (taskId: string) => void
}

export function TaskDetailDialog({ task, tasks, columns, isOpen, onClose, onTaskUpdate, onOpenTask }: TaskDetailDialogProps) {
  // Real-time: listen for task activity events
  const [events, setEvents] = useState<Array<{id:number; action:string; created_at:string; details:any; actor_user_id:number}>>([])
  const [socketInstance, setSocketInstance] = useState<any>(null)
  React.useEffect(() => {
    const id = setInterval(() => {
      try {
        const s = (window as any)._saSocket
        if (s && s.connected) {
          setSocketInstance(s)
          clearInterval(id)
        }
      } catch {}
    }, 250)
    return () => clearInterval(id)
  }, [])
  const [activeTab, setActiveTab] = useState("details")
  const [comment, setComment] = useState("")
  const [taskComments, setTaskComments] = useState<Array<{id:string; user_id:number; content:string; created_at:string; updated_at:string; author_name?:string; author_email?:string}>>([])
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState<string>("")
  const [commentActionsVisibleId, setCommentActionsVisibleId] = useState<string | null>(null)
  const taskCommentIdsRef = useRef<Set<string>>(new Set())

  const uniqueTaskComments = React.useMemo(() => {
    const seen = new Set<string>()
    const out: typeof taskComments = [] as any
    for (const c of taskComments) {
      const idStr = String((c as any).id)
      if (!seen.has(idStr)) {
        seen.add(idStr)
        out.push(c)
      }
    }
    return out
  }, [taskComments])
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
  const [existingAttachments, setExistingAttachments] = useState<Array<{id: string, name: string, url: string, size?: number}>>([])
  const [isAttachmentsOpen, setIsAttachmentsOpen] = useState(false)
  const [selectedAssignees, setSelectedAssignees] = useState<Array<{id: string, name: string, email: string, avatar: string}>>([])

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

  // Load assignee candidates from database users (only same team/company)
  const [peopleList, setPeopleList] = React.useState<Array<{id: string, name: string, email: string, avatar: string, verified?: boolean, team_name?: string}>>([])
  const [teamInfo, setTeamInfo] = React.useState<{member_id: number, company: string, badge_color?: string} | null>(null)
  
  React.useEffect(() => {
    const loadTeamAgents = async () => {
      try {
        const res = await fetch('/api/agents/team?limit=50', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && Array.isArray(data.agents)) {
          const mapped = data.agents.map((u: any) => ({
            id: String(u.id),
            name: (u.name || u.email || '').trim() || u.email,
            email: u.email,
            avatar: u.avatar || '',
            team_name: u.team_name || ''
          }))
          setPeopleList(mapped)
          setTeamInfo(data.team)
        }
      } catch {}
    }
    loadTeamAgents()
  }, [])

  // Initialize selected assignees from task.assignees (array of user ids)
  React.useEffect(() => {
    if (task && Array.isArray((task as any).assignees)) {
      const ids: number[] = (task as any).assignees
      const creatorId = task.creator_id
      
      // Always include the task creator in assignees (they are the one who assigned the task)
      const allAssigneeIds = [...new Set([...ids, ...(creatorId ? [creatorId] : [])])]
      
      const mapped = allAssigneeIds.map((uid) => {
        const person = peopleList.find((p) => Number(p.id) === Number(uid))
        return person || { id: String(uid), name: `User #${uid}`, email: '', avatar: '' }
      })
      setSelectedAssignees(mapped)
    } else {
      setSelectedAssignees([])
    }
  }, [task, peopleList])

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

  const currentStatus = React.useMemo(() => {
    // Prefer group_id if present, else fall back to status string
    const byGroupId = statusOptions.find(s => s.id === task?.group_id?.toString())
    if (byGroupId) return byGroupId
    const byStatus = statusOptions.find(s => s.id === (task?.status || '').toString())
    return byStatus || statusOptions[0] || { id: task?.group_id?.toString() || task?.status || '', label: task?.group_id?.toString() || task?.status || '', color: 'bg-gray-500' }
  }, [statusOptions, task?.group_id, task?.status])
  const filteredStatuses = statusOptions.filter(status => 
    status.label.toLowerCase().includes(statusSearch.toLowerCase())
  )

  // Initialize time from existing task start date
  React.useEffect(() => {
    if (task && (task as any).startDate) {
      const startDate = new Date((task as any).startDate)
      setSelectedStartDate(startDate)
      
      // Always extract time (including midnight)
      const hours = startDate.getHours()
      const minutes = startDate.getMinutes()
      const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
      setStartTime(timeString)
      setShowTimeInput(hours !== 0 || minutes !== 0) // Only show time input if not midnight
    } else {
      // Reset when task has no start date
      setSelectedStartDate(undefined)
      setStartTime("")
      setShowTimeInput(false)
    }
  }, [task])

  // Initialize attachments from task when dialog opens or task changes
  React.useEffect(() => {
    if (task && Array.isArray((task as any).attachments)) {
      const list = ((task as any).attachments as any[]).map((a: any) => ({
        id: String(a.id),
        name: a.name || 'Attachment',
        url: a.url,
        size: a.size,
      }))
      setExistingAttachments(list)
    } else {
      setExistingAttachments([])
    }
  }, [task, JSON.stringify((task as any)?.attachments)])

  // Ensure unique custom fields by id to avoid duplicate React keys
  const uniqueCustomFields = React.useMemo((): Array<{ id: string; title: string; description: string }> => {
    const seen = new Set<string>()
    const result: Array<{ id: string; title: string; description: string }> = []
    for (let i = 0; i < customFields.length; i++) {
      const item = customFields[i] as unknown as { id: string; title: string; description: string }
      const norm: { id: string; title: string; description: string } = {
        id: String(item.id),
        title: String(item.title || ''),
        description: String(item.description || '')
      }
      if (!seen.has(norm.id)) {
        seen.add(norm.id)
        result.push(norm)
      }
    }
    return result
  }, [customFields])

  // Helpers to get current user email for API calls
  const getCurrentUserEmail = (): string | null => {
    try {
      const raw = localStorage.getItem('shoreagents-auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.user?.email || null
    } catch {
      return null
    }
  }

  // Helper to get current user id (Railway id for hybrid)
  const getCurrentUserId = (): number | null => {
    try {
      const raw = localStorage.getItem('shoreagents-auth')
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed?.user) return null
      const id = parsed.hybrid && parsed.user?.railway_id ? Number(parsed.user.railway_id) : Number(parsed.user.id)
      return Number.isFinite(id) ? id : null
    } catch { return null }
  }

  // Current user email (lowercased) for marking "(me)" in lists
  const currentEmail = React.useMemo(() => {
    try {
      const e = getCurrentUserEmail()
      return e ? e.toLowerCase() : null
    } catch {
      return null
    }
  }, [])

  const currentUserId = React.useMemo(() => {
    try { return getCurrentUserId() } catch { return null }
  }, [])

  // Helpers: avatar initials
  const getInitials = (input?: string) => {
    if (!input) return 'U'
    const str = String(input).trim()
    if (str.includes('@')) {
      const base = str.split('@')[0].replace(/[^a-zA-Z]/g, '')
      return (base.slice(0, 1) + base.slice(1, 2)).toUpperCase() || 'U'
    }
    const parts = str.split(/\s+/).filter(Boolean)
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
  }

  const taskIdNum = React.useMemo(() => {
    const n = parseInt(task?.id || '0', 10)
    return Number.isFinite(n) ? n : 0
  }, [task?.id])

  // API: create custom field
  const createCustomField = async () => {
    if (!taskIdNum) return
    const email = getCurrentUserEmail()
    const res = await fetch(`/api/task-activity/custom-fields?email=${encodeURIComponent(email || '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskIdNum, title: '', description: '' })
    })
    if (!res.ok) return
    const data = await res.json()
    if (data?.success && data.field) {
      const next = [
        ...customFields,
        { id: String(data.field.id), title: data.field.title || '', description: data.field.description || '' }
      ]
      setCustomFields(next)
      // Propagate after render without triggering API call
      setTimeout(() => onTaskUpdate(task!.id, { custom_fields: next, __localOnly: true } as any), 0)
    }
  }

  // API: update custom field (title/description)
  const persistCustomField = async (fieldId: string, updates: { title?: string; description?: string }) => {
    const email = getCurrentUserEmail()
    await fetch(`/api/task-activity/custom-fields/${fieldId}?email=${encodeURIComponent(email || '')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    // After persisting, propagate latest local array to parent (local only)
    setTimeout(() => onTaskUpdate(task!.id, { custom_fields: uniqueCustomFields, __localOnly: true } as any), 0)
  }

  // API: delete custom field
  const deleteCustomField = async (fieldId: string) => {
    const email = getCurrentUserEmail()
    await fetch(`/api/task-activity/custom-fields/${fieldId}?email=${encodeURIComponent(email || '')}`, {
      method: 'DELETE'
    })
    const next = uniqueCustomFields.filter(f => f.id !== fieldId)
    setCustomFields(next)
    setTimeout(() => onTaskUpdate(task!.id, { custom_fields: next, __localOnly: true } as any), 0)
  }

  // API: reorder custom fields
  const reorderCustomFields = async (orderedIds: string[]) => {
    if (!taskIdNum) return
    const email = getCurrentUserEmail()
    await fetch(`/api/task-activity/custom-fields?email=${encodeURIComponent(email || '')}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskIdNum, ordered_ids: orderedIds.map(id => parseInt(id, 10)) })
    })
    // No-op: parent was already updated optimistically in onReorder
  }

  // Debounce reorder to avoid spamming PATCH while dragging
  const reorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queueReorder = (ids: string[]) => {
    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current)
    reorderTimerRef.current = setTimeout(() => {
      void reorderCustomFields(ids)
    }, 250)
  }

  // Initialize edited title when task changes
  React.useEffect(() => {
    if (task) {
      setEditedTitle(task.title)
    }
  }, [task])

  // Initialize/sync custom fields from task, but do not clobber local state if order/content is unchanged
  React.useEffect(() => {
    if (task && Array.isArray((task as any).custom_fields)) {
      const incoming: Array<{ id: string; title: string; description: string }> = (task as any).custom_fields
        .slice()
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((f: any) => ({ id: String(f.id), title: f.title || '', description: f.description || '' }))

      const a = incoming
      const b = customFields
      let different = false
      if (a.length !== b.length) {
        different = true
      } else {
        for (let i = 0; i < a.length; i++) {
          if (a[i].id !== b[i].id || a[i].title !== b[i].title || a[i].description !== b[i].description) {
            different = true
            break
          }
        }
      }
      if (different) setCustomFields(incoming)
    } else if (!task) {
      setCustomFields([])
    }
  }, [task, JSON.stringify((task as any)?.custom_fields)])

  // Initialize due date from task data
  React.useEffect(() => {
    if (task && (task as any).dueDate) {
      const dueDate = new Date((task as any).dueDate)
      setSelectedDueDate(dueDate)
      
      // Extract time if it's not midnight
      const hours = dueDate.getHours()
      const minutes = dueDate.getMinutes()
      if (hours !== 0 || minutes !== 0) {
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
        setDueTime(timeString)
        setShowDueTimeInput(true)
      }
    } else {
      // Reset when task has no due date
      setSelectedDueDate(undefined)
      setDueTime("")
      setShowDueTimeInput(false)
    }
  }, [task])

  // Load activity events on open
  React.useEffect(() => {
    const load = async () => {
      if (!isOpen || !task?.id) return
      
      // Clear previous events immediately when switching tasks
      setEvents([])
      
      try {
        const res = await fetch(`/api/task-activity/events?task_id=${encodeURIComponent(task.id)}`)
        if (!res.ok) return
        const data = await res.json()
        if (data?.success && Array.isArray(data.events)) {
          // Replace events completely instead of merging with previous
          setEvents(data.events)
        }
      } catch {}
    }
    
    // Clear events when dialog opens or task changes
    if (isOpen && task?.id) {
      void load()
    } else {
      // Clear events when dialog is not open or no task
      setEvents([])
    }
    
    // Cleanup: clear events when component unmounts or dependencies change
    return () => {
      setEvents([])
    }
  }, [isOpen, task?.id])

  // Comprehensive cleanup when switching tasks
  React.useEffect(() => {
    if (!isOpen || !task?.id) {
      // Clear all task-specific state when dialog is not open or no task
      setEvents([])
      setTaskComments([])
      setComment("")
      setEditingCommentId(null)
      setEditingCommentText("")
      setCommentActionsVisibleId(null)
      setActiveTab("details")
      setIsStatusOpen(false)
      setStatusSearch("")
      setIsAssigneeOpen(false)
      setAssigneeSearch("")
      setIsStartDateOpen(false)
      setIsPriorityOpen(false)
      setIsRelationshipsOpen(false)
      setRelationshipSearch("")
      setIsAttachmentsOpen(false)
      setNewTag("")
      setIsAddingTag(false)
      setIsEditingTitle(false)
      setIsEditingDescription(false)
      setEditedTitle("")
      setEditedDescription("")
      setCustomFields([])
      setUploadedFiles([])
      setExistingAttachments([])
      setSelectedAssignees([])
      setSelectedStartDate(undefined)
      setSelectedDueDate(undefined)
      setStartTime("")
      setDueTime("")
      setShowTimeInput(false)
      setShowDueTimeInput(false)
      setDatePickerMode("start")
      setIsDragOver(false)
    }
  }, [isOpen, task?.id])

  // Real-time apply task-level field changes when parent state updates task
  React.useEffect(() => {
    if (!isOpen || !task) return
    // Sync editable local fields from latest task props
    setEditedTitle(task.title)
    // Dates
    if ((task as any).startDate) {
      const d = new Date((task as any).startDate)
      setSelectedStartDate(d)
      const h = d.getHours(); const m = d.getMinutes()
      setStartTime(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`)
      setShowTimeInput(h !== 0 || m !== 0)
    }
    if ((task as any).dueDate) {
      const d = new Date((task as any).dueDate)
      setSelectedDueDate(d)
      const h = d.getHours(); const m = d.getMinutes()
      setDueTime(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`)
      setShowDueTimeInput(h !== 0 || m !== 0)
    }
    // Custom fields
    if (Array.isArray((task as any).custom_fields)) {
      const incoming = ((task as any).custom_fields as any[])
        .slice()
        .sort((a:any,b:any)=> (a.position??0)-(b.position??0))
        .map((f:any)=>({ id:String(f.id), title:f.title||'', description:f.description||'' }))
      setCustomFields(incoming)
    }
    // Attachments
    if (Array.isArray((task as any).attachments)) {
      const list = ((task as any).attachments as any[]).map((a:any)=>({ id:String(a.id), name:a.name||'Attachment', url:a.url, size:a.size }))
      setExistingAttachments(list)
    }
    // Assignees
    if (Array.isArray((task as any).assignees)) {
      const ids: number[] = (task as any).assignees
      const creatorId = task.creator_id
      
      // Always include the task creator in assignees (they are the one who assigned the task)
      const allAssigneeIds = [...new Set([...ids, ...(creatorId ? [creatorId] : [])])]
      
      const mapped = allAssigneeIds.map((uid) => {
        const person = peopleList.find((p) => Number(p.id) === Number(uid))
        return person || { id: String(uid), name: `User #${uid}`, email: '', avatar: '' }
      })
      setSelectedAssignees(mapped)
    }
  }, [task, isOpen])

  // Subscribe to realtime activity events
  React.useEffect(() => {
    if (!socketInstance || !task?.id) return
    const handler = (payload: any) => {
      try {
        const msg = typeof payload === 'string' ? JSON.parse(payload) : payload
        const ev = msg?.event
        if (ev?.task_id && String(ev.task_id) === String(task.id)) {
          setEvents(prev => (prev.some((e: any) => e.id === ev.id) ? prev : [ev, ...prev]))
        }
      } catch {}
    }
    socketInstance.on('task_activity_event', handler)
    return () => { socketInstance.off('task_activity_event', handler) }
  }, [socketInstance, task?.id])

  // Load comments on open/task change
  React.useEffect(() => {
    let abort = false
    async function load() {
      if (!task?.id) return
      try {
        const res = await fetch(`/api/task-activity/comments?taskId=${task.id}`, { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json().catch(()=>null)
        if (!data?.success || !Array.isArray(data.comments)) return
        if (!abort) {
          const uniq: any[] = []
          const seen = new Set<string>()
          for (const c of data.comments) {
            const idStr = String(c.id)
            if (!seen.has(idStr)) { seen.add(idStr); uniq.push(c) }
          }
          taskCommentIdsRef.current = seen
          setTaskComments(uniq)
        }
      } catch {}
    }
    load()
    return () => { abort = true }
  }, [task?.id, isOpen])

  // Realtime: subscribe to task_comments channel through socket
  React.useEffect(() => {
    if (!socketInstance || !task?.id) return
    const onTaskComment = (raw: any) => {
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (String(payload.task_id) !== String(task.id)) return
        if (payload.event === 'insert') {
          const newId = String(payload.comment_id)
          if (!taskCommentIdsRef.current.has(newId)) {
            taskCommentIdsRef.current.add(newId)
            setTaskComments(prev => [...prev, {
              id: newId,
              user_id: Number(payload.user_id),
              content: payload.comment,
              created_at: payload.created_at,
              updated_at: payload.updated_at || payload.created_at,
              author_name: payload.authorName,
              author_email: payload.authorEmail || payload.author_email,
            }])
          }
        } else if (payload.event === 'update') {
          setTaskComments(prev => prev.map(c => String(c.id) === String(payload.comment_id) ? {
            ...c,
            content: payload.comment ?? c.content,
            updated_at: payload.updated_at || c.updated_at,
          } : c))
        } else if (payload.event === 'delete') {
          const delId = String(payload.comment_id)
          setTaskComments(prev => prev.filter(c => String(c.id) !== delId))
          try { taskCommentIdsRef.current.delete(delId) } catch {}
        }
      } catch {}
    }
    socketInstance.on('task_comments', onTaskComment)
    return () => { socketInstance.off('task_comments', onTaskComment) }
  }, [socketInstance, task?.id])

  // Helpers to render activity events
  const formatRelative = (iso: string) => {
    try {
      const then = new Date(iso).getTime()
      const now = Date.now()
      const diff = Math.max(0, Math.floor((now - then) / 1000))
      if (diff < 60) return `${diff}s`
      const m = Math.floor(diff / 60)
      if (m < 60) return `${m}m`
      const h = Math.floor(m / 60)
      if (h < 24) return `${h}h`
      const d = Math.floor(h / 24)
      if (d < 7) return `${d}d`
      const w = Math.floor(d / 7)
      if (w < 52) return `${w}w`
      const y = Math.floor(d / 365)
      return `${y}y`
    } catch { return '' }
  }

  const toLocalDate = (v: string) => {
    try { return new Date(v).toLocaleDateString() } catch { return v }
  }

  const renderEventSummary = (ev: any): string[] => {
    const d = ev?.details || {}
    const actions: any[] = Array.isArray(d.actions) ? d.actions : []
    const out: string[] = []
    for (const a of actions) {
      switch (a.type) {
        case 'title_changed':
          out.push('Title updated')
          break
        case 'description_changed':
          out.push('Description updated')
          break
        case 'priority_changed':
          out.push(`Priority set to ${a.to}`)
          break
        case 'status_changed':
          out.push(`Status changed${a.toLabel ? ` to ${a.toLabel}` : ''}`)
          break
        case 'start_date_set':
          out.push(`Start date set to ${toLocalDate(a.to)}`)
          break
        case 'due_date_set':
          out.push(`Due date set to ${toLocalDate(a.to)}`)
          break
        case 'tags_added':
          if (Array.isArray(a.tags) && a.tags.length) out.push(`Tags added: ${a.tags.join(', ')}`)
          break
        case 'tags_removed':
          if (Array.isArray(a.tags) && a.tags.length) out.push(`Tags removed: ${a.tags.join(', ')}`)
          break
        case 'assignees_added':
          if (Array.isArray(a.assignees) && a.assignees.length) out.push(`Assignees added: ${a.assignees.map((x:any)=>x.name||x.id).join(', ')}`)
          break
        case 'assignees_removed':
          if (Array.isArray(a.assignees) && a.assignees.length) out.push(`Assignees removed: ${a.assignees.map((x:any)=>x.name||x.id).join(', ')}`)
          break
        case 'relationships_added':
          if (Array.isArray(a.tasks) && a.tasks.length) out.push(`Relationships added: ${a.tasks.map((x:any)=>x.title||x.id).join(', ')}`)
          else if (Array.isArray(a.taskIds)) out.push(`Relationships added: ${a.taskIds.join(', ')}`)
          break
        case 'relationships_removed':
          if (Array.isArray(a.tasks) && a.tasks.length) out.push(`Relationships removed: ${a.tasks.map((x:any)=>x.title||x.id).join(', ')}`)
          else if (Array.isArray(a.taskIds)) out.push(`Relationships removed: ${a.taskIds.join(', ')}`)
          break
        default:
          break
      }
    }
    if (out.length) return out
    // Fallback to coarse info if actions not present
    if (d.priority) out.push(`Priority set to ${d.priority}`)
    if (d.start_date) out.push(`Start date set to ${toLocalDate(d.start_date)}`)
    if (d.due_date) out.push(`Due date set to ${toLocalDate(d.due_date)}`)
    if (d.title) out.push('Title updated')
    if (d.description) out.push('Description updated')
    if (d.tags) out.push('Tags updated')
    if (d.group_id != null) out.push('Status changed')
    if (Array.isArray(d.assignees)) out.push('Assignees updated')
    if (d.relationships) out.push('Relationships updated')
    return out.length ? out : [ev?.action?.replace(/_/g, ' ') || 'Updated']
  }

  const renderEventIcon = (ev: any) => {
    const d = ev?.details || {}
    const actions: any[] = Array.isArray(d.actions) ? d.actions : []
    const primary = actions[0]?.type || (
      d.start_date ? 'start_date_set' :
      d.due_date ? 'due_date_set' :
      d.tags ? 'tags_changed' :
      Array.isArray(d.assignees) ? 'assignees_changed' :
      d.group_id != null ? 'status_changed' :
      d.priority ? 'priority_changed' :
      d.title ? 'title_changed' :
      d.description ? 'description_changed' :
      'default'
    )
    switch (primary) {
      case 'start_date_set':
      case 'due_date_set':
        return <CalendarIcon className="h-3 w-3" />
      case 'tags_added':
      case 'tags_removed':
      case 'tags_changed':
        return <Tag className="h-3 w-3" />
      case 'assignees_added':
      case 'assignees_removed':
      case 'assignees_changed':
        return <Users className="h-3 w-3" />
      case 'relationships_added':
      case 'relationships_removed':
        return <Link className="h-3 w-3" />
      default:
        return <Flag className="h-3 w-3" />
    }
  }

  if (!task) return null

  // Related task ids to hide from the picker (avoid duplicate/bidirectional re-adding)
  const relatedIds = new Set<string>((task.relationships || []).map(rel => String(rel.taskId)))

  const handleStatusChange = (newStatus: string) => {
    // Update both: group_id numeric and status string for UI consistency
    const groupIdNum = Number(newStatus)
    const updates: any = {}
    if (!Number.isNaN(groupIdNum)) {
      updates.group_id = groupIdNum
    }
    updates.status = newStatus
    onTaskUpdate(task.id, updates)
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

  const addCustomField = () => { void createCustomField() }

  const updateCustomField = (fieldId: string, updates: Partial<{title: string, description: string}>) => {
    setCustomFields(prev => prev.map(field => field.id === fieldId ? { ...field, ...updates } : field))
  }

  const removeCustomField = async (fieldId: string) => {
    await deleteCustomField(fieldId)
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
    
    const MAX_BYTES = 5 * 1024 * 1024
    const validFiles = files.filter(file => {
      const typeOk = allowedTypes.some(type => file.type.startsWith(type))
      const sizeOk = file.size <= MAX_BYTES
      return typeOk && sizeOk
    })
    
    const newFiles = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size
    }))
    
    setUploadedFiles(prev => [...prev, ...newFiles])
    // Upload to Supabase tasks bucket via API
    if (validFiles.length > 0) {
      const form = new FormData()
      form.append('taskId', task.id)
      validFiles.forEach(f => form.append('files', f))
      fetch('/api/task-activity/upload', { method: 'POST', body: form })
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json()
          if (data?.files?.length) {
            const serverFiles = (data.files as any[]).map(f => ({ id: String(f.id), name: f.name, url: f.url, size: f.size }))
            const deduped = (() => {
              const map = new Map<string, { id: any; name: string; url: string; size?: number }>()
              ;[...existingAttachments, ...serverFiles].forEach(f => {
                const key = f.id ? `id:${f.id}` : `ns:${f.name}:${f.size}`
                map.set(key, f as any)
              })
              return Array.from(map.values())
            })()
            setExistingAttachments(deduped)
            // Remove previews that were just saved (match by name+size)
            setUploadedFiles(prev => prev.filter(p => !serverFiles.some(sf => sf.name === p.name && sf.size === p.size)))
            // Update parent so Kanban card reflects attachment count/cover immediately
            setTimeout(() => onTaskUpdate(task!.id, { attachments: deduped as any, __localOnly: true } as any), 0)
          }
        })
        .catch(() => {})
    }
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
    
    const MAX_BYTES = 5 * 1024 * 1024
    const validFiles = files.filter(file => {
      const typeOk = allowedTypes.some(type => file.type.startsWith(type))
      const sizeOk = file.size <= MAX_BYTES
      return typeOk && sizeOk
    })
    
    const newFiles = validFiles.map(file => ({
      id: `file-${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size
    }))
    
    setUploadedFiles(prev => [...prev, ...newFiles])
    // Upload to Supabase tasks bucket via API
    if (validFiles.length > 0) {
      const form = new FormData()
      form.append('taskId', task.id)
      validFiles.forEach(f => form.append('files', f))
      fetch('/api/task-activity/upload', { method: 'POST', body: form })
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json()
          if (data?.files?.length) {
            const serverFiles = (data.files as any[]).map(f => ({ id: String(f.id), name: f.name, url: f.url, size: f.size }))
            const deduped = (() => {
              const map = new Map<string, { id: any; name: string; url: string; size?: number }>()
              ;[...existingAttachments, ...serverFiles].forEach(f => {
                const key = f.id ? `id:${f.id}` : `ns:${f.name}:${f.size}`
                map.set(key, f as any)
              })
              return Array.from(map.values())
            })()
            setExistingAttachments(deduped)
            setUploadedFiles(prev => prev.filter(p => !serverFiles.some(sf => sf.name === p.name && sf.size === p.size)))
            setTimeout(() => onTaskUpdate(task!.id, { attachments: deduped as any, __localOnly: true } as any), 0)
          }
        })
        .catch(() => {})
    }
  }

  const removeFile = async (fileId: string) => {
    // If it's an existing DB attachment, id will be numeric in existingAttachments with key `att-${id}` above
    const existing = existingAttachments.find(a => `att-${a.id}` === fileId)
    if (existing) {
      try {
        const idNum = Number(existing.id)
        if (Number.isFinite(idNum)) {
          const res = await fetch(`/api/task-activity/attachments/${idNum}`, { method: 'DELETE' })
          if (!res.ok) return
          setExistingAttachments(prev => prev.filter(a => a.id !== existing.id))
          setTimeout(() => onTaskUpdate(task!.id, { attachments: existingAttachments.filter(a => a.id !== existing.id) as any, __localOnly: true } as any), 0)
        }
      } catch {}
      return
    }
    // Otherwise it's a just-added preview file in this session
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
  }

  const handleAssigneeChange = (newAssignee: string) => {
    onTaskUpdate(task.id, { assignee: newAssignee })
    setIsAssigneeOpen(false)
  }

  const handleAddAssignee = (assignee: {id: string, name: string, email?: string, avatar: string, members?: number}) => {
    // Only task creators can add assignees
    const isTaskCreator = task?.creator_id && currentUserId && Number(task.creator_id) === Number(currentUserId)
    
    if (!isTaskCreator) {
      // Non-creators cannot add assignees
      return
    }
    
    // Convert team to assignee format if it's a team
    const assigneeData = {
      id: assignee.id,
      name: assignee.name,
      email: assignee.email || `${assignee.name.toLowerCase().replace(' ', '.')}@shoreagents.com`,
      avatar: assignee.avatar
    }
    
    // Prevent duplicates
    const exists = selectedAssignees.some(a => a.id === assigneeData.id)
    const updatedAssignees = exists ? selectedAssignees : [...selectedAssignees, assigneeData]
    setSelectedAssignees(updatedAssignees)
    // Persist to DB using join table (array of user IDs)
    const assigneeIds = updatedAssignees
      .map((a) => Number(a.id))
      .filter((n) => Number.isFinite(n)) as number[]
    onTaskUpdate(task.id, { assignees: assigneeIds } as any)
  }

  const handleRemoveAssignee = (assigneeId: string) => {
    // Only task creators can manage assignees
    const isTaskCreator = task?.creator_id && currentUserId && Number(task.creator_id) === Number(currentUserId)
    
    if (!isTaskCreator) {
      // Non-creators cannot remove any assignees (including themselves)
      return
    }
    
    // Prevent task creator from removing themselves as an assignee
    const isRemovingSelf = currentUserId && Number(assigneeId) === Number(currentUserId)
    if (isRemovingSelf) {
      // Task creator cannot remove themselves
      return
    }
    
    const updatedAssignees = selectedAssignees.filter(a => a.id !== assigneeId)
    setSelectedAssignees(updatedAssignees)
    // Persist to DB using join table (array of user IDs)
    const assigneeIds = updatedAssignees
      .map((a) => Number(a.id))
      .filter((n) => Number.isFinite(n)) as number[]
    onTaskUpdate(task.id, { assignees: assigneeIds } as any)
  }

  // Filter people list to exclude already selected assignees
  // Derived value (not a hook) to avoid hook-order issues when task is initially null
  const availablePeople = peopleList.filter(person => !selectedAssignees.some(selected => selected.id === person.id))

  // No team list; using only peopleList

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
      onTaskUpdate(task.id, { start_date: finalDate.toISOString() } as any)
    }
  }

  const handleQuickDateSelect = (type: string) => {
    const date = getQuickDate(type)
    if (datePickerMode === "start") {
    handleStartDateChange(date)
    } else {
      handleDueDateChange(date)
    }
  }

  const handleTimeChange = (time: string) => {
    setStartTime(time)
    
    if (selectedStartDate && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const dateWithTime = new Date(selectedStartDate)
      dateWithTime.setHours(hours, minutes, 0, 0)
      
      // Update task with date including time
      onTaskUpdate(task.id, { start_date: dateWithTime.toISOString() } as any)
    }
  }

  const handleDueTimeChange = (time: string) => {
    setDueTime(time)
    
    if (selectedDueDate && time) {
      const [hours, minutes] = time.split(':').map(Number)
      const dateWithTime = new Date(selectedDueDate)
      dateWithTime.setHours(hours, minutes, 0, 0)
      
      // Update task with due date including time
      onTaskUpdate(task.id, { due_date: dateWithTime.toISOString() } as any)
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
      onTaskUpdate(task.id, { due_date: finalDate.toISOString() } as any)
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
    // Check if user has permission to edit the title
    const isTaskOwner = task.is_owner === true
    if (!isTaskOwner) {
      toast.error("Cannot rename task", {
        description: "Only the task creator can rename tasks. Contact the creator to request changes.",
        duration: 4000,
      })
      return
    }
    
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
    
    // Add time if it's set (always show time, including midnight)
    if (time) {
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
                                      status.id === task.group_id?.toString() && "bg-accent"
                                    )}
                                    onClick={() => handleStatusChange(status.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={cn("w-3 h-3 rounded-full", status.color)} />
                                      <span className="text-sm">{status.label}</span>
                                    </div>
                                    {(status.id === task.group_id?.toString() || status.id === task.status?.toString()) && (
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
                {/* Removed stray action menu button to avoid duplicate ... icon */}
              </div>
            </DialogHeader>

            {/* Content */}
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="flex-1 overflow-hidden">
                <div className="grid grid-cols-3 gap-6 p-6 h-full">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Assignees */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            Assignees
                            {teamInfo && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({teamInfo.company})
                              </span>
                            )}
                          </span>
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
                                {selectedAssignees.length > 0 && (
                                  <>
                                    <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                      Assignees
                                    </div>
                                    {selectedAssignees.map((assignee) => (
                                      <div
                                        key={assignee.id}
                                        className="flex items-center justify-between p-2 rounded hover:bg-accent cursor-pointer"
                                      >
                                        <div className="flex items-center gap-3">
                                          <Avatar className="h-6 w-6">
                                            <AvatarFallback className="text-xs">
                                              {assignee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex flex-col">
                      <span className="text-sm">
                        {assignee.name}
                        {currentEmail && assignee.email && assignee.email.toLowerCase() === currentEmail && (
                          <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                        )}
                        {task?.creator_id && Number(task.creator_id) === Number(assignee.id) && (
                          <span className="ml-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-1.5 py-0.5 rounded-full">creator</span>
                        )}
                      </span>
                                            <span className="text-xs text-muted-foreground">{assignee.email}</span>
                                          </div>
                                        </div>
                                        {(() => {
                                          const isTaskCreator = task?.creator_id && currentUserId && Number(task.creator_id) === Number(currentUserId)
                                          const isAssigneeTheCreator = task?.creator_id && Number(task.creator_id) === Number(assignee.id)
                                          const isRemovingSelf = currentUserId && Number(assignee.id) === Number(currentUserId)
                                          
                                          // Only task creators can remove assignees, and they cannot remove themselves
                                          const canRemove = isTaskCreator && !(isAssigneeTheCreator && isRemovingSelf)
                                          
                                          let tooltipText = "Remove assignee"
                                          if (!isTaskCreator) {
                                            tooltipText = "Only task creator can manage assignees"
                                          } else if (isAssigneeTheCreator && isRemovingSelf) {
                                            tooltipText = "Task creator cannot remove themselves"
                                          }
                                          
                                          return (
                                            <Button 
                                              variant="ghost" 
                                              size="sm" 
                                              className={cn(
                                                "h-6 w-6 p-0",
                                                !canRemove && "opacity-50 cursor-not-allowed"
                                              )}
                                              onClick={() => canRemove && handleRemoveAssignee(assignee.id)}
                                              disabled={!canRemove}
                                              title={tooltipText}
                                            >
                                              ×
                                            </Button>
                                          )
                                        })()}
                                      </div>
                                    ))}
                                    <div className="h-2"></div>
                                  </>
                                )}

                                {/* People Section - Only show for task creators */}
                                {task?.creator_id && currentUserId && Number(task.creator_id) === Number(currentUserId) && (
                                  <>
                                    <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                                      {teamInfo ? `Team: ${teamInfo.company}` : 'Team Members'}
                                    </div>
                                                                      {availablePeople.length === 0 ? (
                                      <div className="text-center py-4 text-muted-foreground text-sm">
                                        <p>No team members found</p>
                                        <p className="text-xs">You can only assign tasks to agents in your team</p>
                                      </div>
                                    ) : (
                                      availablePeople
                                        .filter(person => 
                                          person.name.toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                                          person.email.toLowerCase().includes(assigneeSearch.toLowerCase())
                                        )
                                        .map((person) => (
                                          <Button
                                            key={person.id}
                                            variant="ghost"
                                            className="w-full justify-start h-auto p-2"
                                            onClick={() => handleAddAssignee(person)}
                                          >
                                            <div className="flex items-center gap-3 w-full">
                                              <Avatar className="h-6 w-6">
                                                <AvatarFallback className="text-xs">
                                                  {person.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <div className="flex flex-col items-start flex-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-sm">
                                                    {person.name}
                                                    {currentEmail && person.email && person.email.toLowerCase() === currentEmail && (
                                                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                                                    )}
                                                  </span>
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
                                                                              ))
                                    )}

                                    <div className="h-2"></div>
                                  </>
                                )}

                                {/* Team Section removed */}
                              </div>
                            </ScrollArea>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {selectedAssignees.length > 0 ? (
                          selectedAssignees.slice(0, 5).map((assignee) => (
                            <div key={assignee.id} className="flex items-center gap-1.5 border rounded-md px-1.5 py-0.5 text-xs">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[10px]">
                                  {assignee.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                                      <span className="text-xs">
                      {assignee.name}
                      {currentEmail && assignee.email && assignee.email.toLowerCase() === currentEmail && (
                        <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                      )}
                      {task?.creator_id && Number(task.creator_id) === Number(assignee.id) && (
                        <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 px-1 py-0.5 rounded-full">creator</span>
                      )}
                    </span>
                              {(() => {
                                const isTaskCreator = task?.creator_id && currentUserId && Number(task.creator_id) === Number(currentUserId)
                                const isAssigneeTheCreator = task?.creator_id && Number(task.creator_id) === Number(assignee.id)
                                const isRemovingSelf = currentUserId && Number(assignee.id) === Number(currentUserId)
                                
                                // Only task creators can remove assignees, and they cannot remove themselves
                                const canRemove = isTaskCreator && !(isAssigneeTheCreator && isRemovingSelf)
                                
                                let tooltipText = "Remove"
                                if (!isTaskCreator) {
                                  tooltipText = "Only task creator can manage assignees"
                                } else if (isAssigneeTheCreator && isRemovingSelf) {
                                  tooltipText = "Task creator cannot remove themselves"
                                }
                                
                                return (
                                  <button
                                    type="button"
                                    className={cn(
                                      "ml-1 text-[10px] text-muted-foreground hover:text-destructive",
                                      !canRemove && "opacity-50 cursor-not-allowed"
                                    )}
                                    onClick={(e) => { 
                                      e.preventDefault(); 
                                      e.stopPropagation(); 
                                      if (canRemove) handleRemoveAssignee(assignee.id)
                                    }}
                                    disabled={!canRemove}
                                    title={tooltipText}
                                  >
                                    ×
                                  </button>
                                )
                              })()}
                            </div>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Unassigned</span>
                        )}
                        {selectedAssignees.length > 5 && (
                          <span className="text-xs text-muted-foreground">+{selectedAssignees.length - 5} more</span>
                        )}
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
                                                    onTaskUpdate(task.id, { start_date: getCurrentDate()!.toISOString() } as any)
                                                  } else {
                                                    onTaskUpdate(task.id, { due_date: getCurrentDate()!.toISOString() } as any)
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
                                    !relatedIds.has(String(t.id)) &&
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
                                // Skip invalid relationships
                                if (!relationship || typeof relationship !== 'object') {
                                  console.warn('Invalid relationship object:', relationship)
                                  return null
                                }
                                
                                // Skip relationships with invalid taskId
                                if (!relationship?.taskId) {
                                  console.warn('Relationship missing taskId:', relationship)
                                  return null
                                }
                                
                                const relatedTask = tasks?.find(t => t.id === relationship.taskId)
                                
                                // Handle accessible relationships (task found in user's list)
                                if (relatedTask) {
                                  return (
                                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                                      <div 
                                        className="flex items-center gap-2 cursor-pointer hover:bg-accent rounded px-1 py-0.5"
                                        onClick={() => onOpenTask?.(relatedTask.id)}
                                        title="Open related task"
                                      >
                                        <span className="text-xs text-muted-foreground capitalize">
                                          {relationship.type ? relationship.type.replace('_', ' ') : 'Unknown'}
                                        </span>
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
                                  )
                                }
                                
                                // Handle private relationships (task not accessible)
                                return (
                                  <div key={index} className="flex items-center justify-between p-2 border rounded bg-muted/30">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground capitalize">
                                        {relationship.type ? relationship.type.replace('_', ' ') : 'Unknown'}
                                      </span>
                                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        🔒 Private Task
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                                          No access
                                        </span>
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleRemoveRelationship(relationship)}
                                      title="Remove relationship"
                                    >
                                      ×
                                    </Button>
                                  </div>
                                )
                              }).filter(Boolean)}
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
                                {uniqueCustomFields.length > 0 ? (
                                  <Reorder.Group
                                    axis="y"
                                    values={uniqueCustomFields}
                                    onReorder={(newOrder) => {
                                      setCustomFields(newOrder)
                                      // Immediately propagate the new visual order to parent so reopen reflects it
                                      setTimeout(() => onTaskUpdate(task!.id, { custom_fields: newOrder, __localOnly: true } as any), 0)
                                      // Persist order in the background (debounced)
                                      queueReorder(newOrder.map(f => f.id))
                                    }}
                                  >
                                    {uniqueCustomFields.map((field, index) => (
                                      <Reorder.Item key={`cf-${field.id}`} value={field}>
                                        <Card className="p-3">
                                      <div className="flex items-start gap-3">
                                        <div className="flex-1 space-y-2">
                                          <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-grab">
                                                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                    <circle cx="4" cy="4" r="1.5"/><circle cx="10" cy="4" r="1.5"/><circle cx="16" cy="4" r="1.5"/>
                                                    <circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="16" cy="10" r="1.5"/>
                                                    <circle cx="4" cy="16" r="1.5"/><circle cx="10" cy="16" r="1.5"/><circle cx="16" cy="16" r="1.5"/>
                                                  </svg>
                                                  Drag
                                                </span>
                                            <Input
                                              value={field.title}
                                              onChange={(e) => updateCustomField(field.id, { title: e.target.value })}
                                                  onBlur={() => persistCustomField(field.id, { title: field.title })}
                                              placeholder="Field title"
                                              className="h-8 text-sm"
                                            />
                                          </div>
                                          <Input
                                            value={field.description}
                                            onChange={(e) => updateCustomField(field.id, { description: e.target.value })}
                                                onBlur={() => persistCustomField(field.id, { description: field.description })}
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
                                      </Reorder.Item>
                                    ))}
                                  </Reorder.Group>
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
                          
                          {(() => { const count = existingAttachments.length + uploadedFiles.length; return count > 0 })() && (
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
                                        {(existingAttachments.length + uploadedFiles.length)} attachment{(existingAttachments.length + uploadedFiles.length) !== 1 ? 's' : ''}
                                      </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-64">
                                  <div className="p-2">
                                    <div className="text-xs font-medium text-muted-foreground mb-2">
                                      Attachments ({existingAttachments.length + uploadedFiles.length})
                                    </div>
                                    {existingAttachments.map((file, idx) => (
                                      <div key={`att-${file.id}`} className="flex items-center justify-between p-2 rounded hover:bg-accent">
                                        <a href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 flex-1 min-w-0 text-sm truncate">
                                          <Paperclip className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                          <span className="truncate">{file.name}</span>
                                        </a>
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 px-1 text-xs"
                                            onClick={async () => {
                                              try {
                                                const ordered = [file.id, ...existingAttachments.filter(f => f.id !== file.id).map(f => f.id)]
                                                const res = await fetch('/api/task-activity/attachments', {
                                                  method: 'PATCH',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ task_id: Number(task.id), ordered_ids: ordered.map(id => Number(id)) })
                                                })
                                                if (!res.ok) return
                                                const next = [file, ...existingAttachments.filter(f => f.id !== file.id)]
                                                setExistingAttachments(next)
                                                setTimeout(() => onTaskUpdate(task!.id, { attachments: next as any, __localOnly: true } as any), 0)
                                              } catch {}
                                            }}
                                            title={idx === 0 ? 'Cover' : 'Set as cover'}
                                          >
                                            {idx === 0 ? 'Cover' : 'Make cover'}
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 flex-shrink-0"
                                            onClick={() => removeFile(`att-${file.id}`)}
                                          >
                                            ×
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
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
                        {events.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No recent activity</div>
                        ) : (
                          events.map(ev => (
                            <div key={ev.id} className="text-xs text-muted-foreground">
                            {renderEventSummary(ev).map((line, idx) => (
                                <div key={`${ev.id}-${idx}`} className={idx === 0 ? 'mb-1 flex items-center gap-2' : ''}>
                                  {idx === 0 && renderEventIcon(ev)}
                                  <span className={idx === 0 ? 'font-normal' : ''}>{line}</span>
                          </div>
                              ))}
                              <span>{formatRelative(ev.created_at)}</span>
                        </div>
                          ))
                        )}
                          </div>
                    </ScrollArea>

                    {/* Comments List */}
                    <div className="mt-6">
                      <h4 className="text-sm font-medium mb-2">Comments</h4>
                      <ScrollArea className="h-[180px] pr-2">
                        <div className="space-y-3">
                          {taskComments.length === 0 ? (
                            <div className="text-xs text-muted-foreground">No comments yet.</div>
                          ) : (
                            taskComments.map((c) => {
                              const canEdit = currentUserId && Number(currentUserId) === Number(c.user_id)
                              const isEditing = editingCommentId === String(c.id)
                              return (
                                <div key={c.id} className="text-xs group">
                                  <div
                                    className={cn(
                                      "relative rounded p-2",
                                      currentUserId && Number(currentUserId) === Number(c.user_id)
                                        ? "bg-muted/40"
                                        : "bg-accent/20"
                                    )}
                                    onClick={() => setCommentActionsVisibleId(prev => prev === String(c.id) ? null : String(c.id))}
                                  >
                                    <div className="flex items-start gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[10px]">
                                          {getInitials(c.author_name || c.author_email)}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-foreground truncate">
                                          {c.author_name || c.author_email || 'User'}
                        </div>
                                        <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                      {isEditing ? (
                                        <div className="space-y-2">
                                          <Textarea value={editingCommentText} onChange={(e)=>setEditingCommentText(e.target.value)} />
                                          <div className="flex gap-2 justify-end">
                                            <Button variant="outline" size="sm" onClick={()=>{ setEditingCommentId(null); setEditingCommentText('') }}>Cancel</Button>
                                            <Button size="sm" onClick={async ()=>{
                                              const trimmed = editingCommentText.trim(); if (!trimmed) return
                                              try {
                                                const res = await fetch(`/api/task-activity/comments/${c.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ content: trimmed }) })
                                                if (res.ok) {
                                                  const data = await res.json().catch(()=>null)
                                                  const updatedAt = data?.comment?.updated_at || new Date().toISOString()
                                                  setTaskComments(prev => prev.map(cc => String(cc.id)===String(c.id) ? { ...cc, content: trimmed, updated_at: updatedAt } : cc))
                                                  setEditingCommentId(null)
                                                  setEditingCommentText('')
                                                }
                                              } catch {}
                                            }}>Save</Button>
                          </div>
                        </div>
                                          ) : (
                                            c.content
                                          )}
                          </div>
                        </div>
                          </div>
                                    {canEdit && (
                                      <div className={`absolute right-1 top-1 transition-opacity duration-150 ${commentActionsVisibleId===String(c.id) ? 'opacity-100' : 'opacity-0 pointer-events-none'} group-hover:opacity-100 group-hover:pointer-events-auto`}>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 p-0">
                                              <MoreHorizontal className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" className="w-36">
                                            <DropdownMenuItem onClick={() => { setEditingCommentId(String(c.id)); setEditingCommentText(c.content) }}>Edit</DropdownMenuItem>
                                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async ()=>{
                                              try {
                                                const res = await fetch(`/api/task-activity/comments/${c.id}`, { method: 'DELETE', credentials: 'include' })
                                                if (res.ok) setTaskComments(prev => prev.filter(cc => String(cc.id)!==String(c.id)))
                                              } catch {}
                                            }}>Delete</DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                        </div>
                                    )}
                          </div>
                                  <div className="mt-1 text-[10px] text-muted-foreground text-right">{formatRelative(c.created_at)}</div>
                        </div>
                              )
                            })
                          )}
                      </div>
                    </ScrollArea>
                    </div>

                    {/* Add Comment */}
                    <div className="mt-3 space-y-2">
                      <Textarea
                        placeholder="Write a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="min-h-[70px]"
                      />
                      <div className="flex justify-end">
                        <Button size="sm" onClick={async () => {
                          const trimmed = comment.trim()
                          if (!trimmed || !task?.id) return
                          try {
                            const res = await fetch('/api/task-activity/comments', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              credentials: 'include',
                              body: JSON.stringify({ taskId: task.id, content: trimmed }),
                            })
                            const data = await res.json().catch(()=>null)
                            if (res.ok && data?.success && data.comment) {
                              const newId = String(data.comment.id)
                              if (!taskCommentIdsRef.current.has(newId)) {
                                taskCommentIdsRef.current.add(newId)
                                setTaskComments(prev => [...prev, data.comment])
                              }
                              setComment('')
                            }
                          } catch {}
                        }}>Send</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 