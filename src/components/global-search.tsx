"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Search, Clock, FileText, CheckSquare, Users, Activity, X, Command } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useDebouncedGlobalSearch, SearchResult } from "@/hooks/use-global-search"

interface GlobalSearchProps {
  className?: string
}

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Use React Query hook for debounced search
  const { data: searchData, isLoading: loading, results, isCached } = useDebouncedGlobalSearch(query)

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  // Navigation handlers
  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery("")
    router.push(result.url)
  }



  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) {
      acc[result.type] = []
    }
    acc[result.type].push(result)
    return acc
  }, {} as Record<string, SearchResult[]>)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ticket': return FileText
      case 'task': return CheckSquare
      case 'break': return Clock
      case 'meeting': return Users
      case 'health': return Activity
      case 'user': return Users
      case 'page': return FileText
      default: return Search
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'ticket': return 'Tickets'
      case 'task': return 'Tasks'
      case 'break': return 'Breaks'
      case 'meeting': return 'Meetings'
      case 'health': return 'Health'
      case 'user': return 'Users'
      case 'page': return 'Pages'
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
          "relative h-8 w-full justify-start rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Search Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          ref={inputRef}
          placeholder="Search tickets, tasks, breaks, meetings..."
          value={query}
          onValueChange={setQuery}
        />
        <ScrollArea className="h-[400px]">
          <div className="p-2">
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
                                 <div
                   onClick={() => handleSelect({ id: 'new-ticket', title: 'New Ticket', type: 'page', url: '/forms/new' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">New Ticket</span>
                   </div>
                 </div>
                 <div
                   onClick={() => handleSelect({ id: 'dashboard', title: 'Dashboard', type: 'page', url: '/dashboard' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">Dashboard</span>
                   </div>
                 </div>
                 <div
                   onClick={() => handleSelect({ id: 'my-tickets', title: 'My Tickets', type: 'page', url: '/forms/my-tickets' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">My Tickets</span>
                   </div>
                 </div>
                 <div
                   onClick={() => handleSelect({ id: 'notifications', title: 'Notifications', type: 'page', url: '/notifications' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">Notifications</span>
                   </div>
                 </div>
                
                <div className="h-px bg-border mx-2 my-2" />
                
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Navigation
                </div>
                                 <div
                   onClick={() => handleSelect({ id: 'help', title: 'Help & Support', type: 'page', url: '/help' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">Help & Support</span>
                   </div>
                 </div>
                 <div
                   onClick={() => handleSelect({ id: 'settings', title: 'Settings', type: 'page', url: '/settings/profile' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">Settings</span>
                   </div>
                 </div>
                 <div
                   onClick={() => handleSelect({ id: 'productivity', title: 'Productivity', type: 'page', url: '/productivity/task-activity' })}
                   className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                 >
                   <div className="h-4 w-4 rounded-full border border-muted-foreground/30 flex-shrink-0 transition-colors duration-200 hover:border-muted-foreground/60" />
                   <div className="flex-1 min-w-0">
                     <span className="font-medium text-foreground transition-colors duration-200 hover:text-foreground/90">Productivity</span>
                   </div>
                 </div>
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
                      {typeResults.map((result, index) => (
                                                 <div
                           key={result.id}
                           onClick={() => handleSelect(result)}
                           className="flex items-center gap-3 p-3 cursor-pointer rounded-sm transition-all duration-200 hover:bg-muted/50"
                         >
                          <Icon className="h-4 w-4 text-muted-foreground/60 flex-shrink-0 transition-colors duration-200 hover:text-muted-foreground/80" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-foreground truncate transition-colors duration-200 hover:text-foreground/90">{result.title}</span>
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
                              <p className="text-sm text-muted-foreground/70 truncate">
                                {result.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/60">
                              {result.metadata?.category && (
                                <span>{result.metadata.category}</span>
                              )}
                              {result.metadata?.date && (
                                <span>• {result.metadata.date}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
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
