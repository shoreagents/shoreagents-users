"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search, Clock, FileText, CheckSquare, Users, Activity, X, Command, Calendar, HelpCircle, Toilet } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandInput,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useDebouncedGlobalSearch, SearchResult } from "@/hooks/use-global-search"

interface GlobalSearchProps {
  className?: string
}

function truncateMessage(message: string, maxLength: number = 30): string {
  if (message.length <= maxLength) {
    return message
  }
  
  // Find the last space before the max length to avoid cutting words
  const truncated = message.substring(0, maxLength)
  const lastSpaceIndex = truncated.lastIndexOf(' ')
  
  if (lastSpaceIndex > maxLength * 0.7) {
    // If we found a space in a reasonable position, cut there
    return message.substring(0, lastSpaceIndex) + '...'
  } else {
    // Otherwise, just cut at max length and add ellipsis
    return truncated + '...'
  }
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  // Use React Query hook for debounced search
  const { data: searchData, isLoading: loading, results, isCached } = useDebouncedGlobalSearch(query)

  // Create flattened list of all selectable items
  const quickActions: SearchResult[] = [
    { id: 'dashboard', title: 'Dashboard', type: 'page', url: '/dashboard' },
    { id: 'analytics', title: 'Leaderboard', type: 'page', url: '/dashboard/leaderboard' },
    { id: 'activity', title: 'Activity', type: 'page', url: '/dashboard/activity' },
    { id: 'my-tickets', title: 'My Tickets', type: 'page', url: '/forms/my-tickets' },
    { id: 'task', title: 'Task', type: 'page', url: '/productivity/task-activity' },
    { id: 'notifications', title: 'Notifications', type: 'page', url: '/notifications' },
    { id: 'Profile', title: 'Profile', type: 'page', url: '/settings/profile' },
    { id: 'password', title: 'Password', type: 'page', url: '/settings/password' },
    { id: 'team', title: 'Team', type: 'page', url: '/settings/connected-users' },
    { id: 'faq', title: 'FAQ', type: 'page', url: '/help/faq' },
    { id: 'contact', title: 'Contact Support', type: 'page', url: '/help/contact' },
    { id: 'report', title: 'Report Issues', type: 'page', url: '/help/report' },
    { id: 'events', title: 'Events & Activities', type: 'page', url: '/status/events' },
    { id: 'restroom', title: 'Restroom', type: 'page', url: '/status/restroom' },
    { id: 'clinic', title: 'Clinic', type: 'page', url: '/status/health' },
    { id: 'meetings', title: 'Meetings', type: 'page', url: '/status/meetings' },
    { id: 'breaks', title: 'Breaks', type: 'page', url: '/status/breaks' },
  ]

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  // Create flattened list from grouped results to maintain display order
  const flattenedResultsFromGroups: SearchResult[] = []
  Object.entries(groupedResults).forEach(([type, typeResults]) => {
    typeResults.forEach(result => {
      flattenedResultsFromGroups.push(result)
    })
  })

  const allSelectableItems = query ? flattenedResultsFromGroups : quickActions
  const maxIndex = allSelectableItems.length - 1

  // Create a map for quick index lookup
  const resultIndexMap = new Map<string, number>()
  allSelectableItems.forEach((item, index) => {
    const key = `${item.id}-${item.type}`
    resultIndexMap.set(key, index)
  })

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Navigation handlers
  const handleSelect = useCallback((result: SearchResult) => {
    setOpen(false)
    setQuery("")
    router.push(result.url)
  }, [router])

  // Auto-scroll to selected item
  useEffect(() => {
    if (scrollAreaRef.current && allSelectableItems.length > 0) {
      const selectedElement = scrollAreaRef.current.querySelector(`[data-index="${selectedIndex}"]`)
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        })
      }
    }
  }, [selectedIndex, allSelectableItems.length])

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < maxIndex ? prev + 1 : 0)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : maxIndex)
        break
      case 'Enter':
        e.preventDefault()
        if (allSelectableItems[selectedIndex]) {
          handleSelect(allSelectableItems[selectedIndex])
        }
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }, [open, maxIndex, allSelectableItems, selectedIndex, handleSelect])

  // Keyboard shortcut handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Add keyboard navigation when dialog is open
  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, selectedIndex, allSelectableItems, handleKeyDown])

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ticket': return FileText
      case 'task': return CheckSquare
      case 'break': return Clock
      case 'meeting': return Users
      case 'event': return Calendar
      case 'health': return Activity
      case 'clinic': return Activity
      case 'restroom': return Toilet
      case 'user': return Users
      case 'page': return FileText
      case 'faq': return HelpCircle
      default: return Search
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'ticket': return 'Tickets'
      case 'task': return 'Tasks'
      case 'break': return 'Breaks'
      case 'meeting': return 'Meetings'
      case 'event': return 'Events & Activities'
      case 'health': return 'Health'
      case 'clinic': return 'Clinic'
      case 'restroom': return 'Restroom'
      case 'user': return 'Users'
      case 'page': return 'Pages'
      case 'faq': return 'Help & FAQ'
      default: return 'Other'
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'closed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      case 'resolved': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'pending': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      case 'active': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
      case 'completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
      case 'high': return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200'
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      case 'low': return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  return (
    <>
      {/* Search Button */}
      <Button
        variant="outline"
        className={cn(
          "relative h-8 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64 hover:text-muted-foreground",
          className
        )}
        onClick={() => setOpen(true)}
        data-search-trigger
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-[10px] leading-none pt-0.5">Ctrl</span>
          <span className="text-[10px] leading-none pt-0.5">K</span>
        </kbd>
      </Button>

      {/* Search Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen} className="max-w-xl">
        <CommandInput
          ref={inputRef}
          placeholder="Search tickets, tasks, breaks, meetings, events..."
          value={query}
          onValueChange={setQuery}
        />
        <ScrollArea ref={scrollAreaRef} className="h-[400px]">
          <div className="p-2 max-w-xl">
            {loading && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  Searching...
                </div>
              </div>
            )}
            
            {!loading && query && results.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            )}

            

            {!loading && !query && (
              <>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Quick Actions
                </div>
                {quickActions.map((action, index) => {
                  const isSelected = selectedIndex === index
                  return (
                    <div
                      key={action.id}
                      data-index={index}
                      onClick={() => handleSelect(action)}
                      className={cn(
                        "flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200",
                        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "h-4 w-4 rounded-full border flex-shrink-0 transition-colors duration-200",
                        isSelected 
                          ? "border-accent-foreground/60" 
                          : "border-muted-foreground/30 hover:border-muted-foreground/60"
                      )} />
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "font-medium transition-colors duration-200",
                          isSelected 
                            ? "text-accent-foreground" 
                            : "text-foreground hover:text-foreground/90"
                        )}>
                          {action.title}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {!loading && results.length > 0 && (
              <>
                {Object.entries(groupedResults).map(([type, typeResults], groupIndex) => {
                  const Icon = getTypeIcon(type)
                  return (
                    <div key={type}>
                      {groupIndex > 0 && <div className="h-px bg-border mx-2 my-2" />}
                      <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                        {getTypeLabel(type)}
                      </div>
                      {typeResults.map((result, index) => {
                        // Find the global index of this result using the index map
                        const key = `${result.id}-${result.type}`
                        const globalIndex = resultIndexMap.get(key) ?? -1
                        const isSelected = selectedIndex === globalIndex
                        
                        return (
                          <div
                            key={result.id}
                            data-index={globalIndex}
                            onClick={() => handleSelect(result)}
                            className={cn(
                              "flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200",
                              isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                            )}
                          >
                            <Icon className={cn(
                              "h-4 w-4 flex-shrink-0 transition-colors duration-200",
                              isSelected 
                                ? "text-accent-foreground/80" 
                                : "text-muted-foreground/60 hover:text-muted-foreground/80"
                            )} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "font-medium transition-colors duration-200",
                                  isSelected 
                                    ? "text-accent-foreground" 
                                    : "text-foreground hover:text-foreground/90"
                                )}>
                                  {truncateMessage(result.title, 50)}
                                </span>
                                {result.metadata?.status && (
                                  <Badge 
                                    variant="secondary" 
                                    className={cn("text-xs", getStatusColor(result.metadata.status))}
                                  >
                                    {result.metadata.status}
                                  </Badge>
                                )}
                                {result.metadata?.priority && (
                                  <Badge 
                                    variant="outline" 
                                    className={cn("text-xs", getStatusColor(result.metadata.priority))}
                                  >
                                    {result.metadata.priority}
                                  </Badge>
                                )}
                              </div>
                              {result.description && (
                                <p className={cn(
                                  "text-sm transition-colors duration-200 line-clamp-2 max-w-xl w-full",
                                  isSelected 
                                    ? "text-accent-foreground/70" 
                                    : "text-muted-foreground/70"
                                )}>
                                  {result.description}
                                </p>
                              )}
                              <div className={cn(
                                "flex items-center gap-2 mt-1 text-xs transition-colors duration-200",
                                isSelected 
                                  ? "text-accent-foreground/60" 
                                  : "text-muted-foreground/60"
                              )}>
                                {result.metadata?.category && (
                                  <span>{result.metadata.category}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </ScrollArea>
      </CommandDialog>
    </>
  )
}
