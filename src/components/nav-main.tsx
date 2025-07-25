"use client"

import { useState, useEffect } from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url?: string
    icon?: LucideIcon
    isActive?: boolean
    statusIndicator?: React.ReactNode
    items?: {
      title: string
      url: string
      statusIndicator?: React.ReactNode
    }[]
  }[]
}) {
  const pathname = usePathname()
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const [isInitialized, setIsInitialized] = useState(false)

  // Load saved dropdown states from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isInitialized) {
      try {
        const saved = localStorage.getItem('sidebar-dropdown-states')
        if (saved) {
          const parsed = JSON.parse(saved)
          setOpenItems(parsed)
        } else {
          // Initialize with currently active items open if no saved state
          const initial: Record<string, boolean> = {}
          items.forEach(item => {
            if (item.isActive) {
              initial[item.title] = true
            }
          })
          setOpenItems(initial)
        }
      } catch (error) {
        console.error('Error loading sidebar dropdown states:', error)
        // Fallback to active items open
        const initial: Record<string, boolean> = {}
        items.forEach(item => {
          if (item.isActive) {
            initial[item.title] = true
          }
        })
        setOpenItems(initial)
      }
      setIsInitialized(true)
    }
  }, [items, isInitialized])

  // Save dropdown states to localStorage whenever they change
  useEffect(() => {
    if (isInitialized && typeof window !== 'undefined') {
      try {
        localStorage.setItem('sidebar-dropdown-states', JSON.stringify(openItems))
      } catch (error) {
        console.error('Error saving sidebar dropdown states:', error)
      }
    }
  }, [openItems, isInitialized])

  const toggleItem = (itemTitle: string) => {
    setOpenItems(prev => ({
      ...prev,
      [itemTitle]: !prev[itemTitle]
    }))
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible
            key={item.title}
            asChild
            open={openItems[item.title]}
            onOpenChange={(open) => setOpenItems(prev => ({ ...prev, [item.title]: open }))}
            className="group/collapsible"
          >
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton 
                  tooltip={item.title} 
                  isActive={item.isActive}
                  className={item.isActive ? "bg-primary/10 text-primary border-l-2 border-primary" : ""}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  {item.statusIndicator && (
                    <span className="mr-2">
                      {item.statusIndicator}
                    </span>
                  )}
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {item.items?.map((subItem) => {
                    const isSubItemActive = pathname === subItem.url
                    return (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton 
                          asChild 
                          isActive={isSubItemActive}
                          className={isSubItemActive ? "bg-primary/15 text-primary font-medium border-l-2 border-primary ml-2" : ""}
                        >
                          <Link href={subItem.url}>
                            <span>{subItem.title}</span>
                            {subItem.statusIndicator && (
                              <span className="ml-auto mr-2">
                                {subItem.statusIndicator}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    )
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
