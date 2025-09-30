"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { NewTicketDialog } from "@/components/new-ticket-dialog"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  HelpCircle,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { HelpFaqSkeleton } from "@/components/skeleton-loaders"
import { faqData } from "@/lib/faq-data"

// Transform the FAQ data to match the expected structure
const transformedFaqData = faqData.reduce((acc, item) => {
  const existingCategory = acc.find(cat => cat.category === item.category)
  if (existingCategory) {
    existingCategory.items.push({
      question: item.question,
      answer: item.answer,
      id: item.id
    })
  } else {
    acc.push({
      category: item.category,
      items: [{
        question: item.question,
        answer: item.answer,
        id: item.id
      }]
    })
  }
  return acc
}, [] as Array<{ category: string; items: Array<{ question: string; answer: string; id: string }> }>)

export default function FAQPage() {
  const [loading, setLoading] = useState(true)
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false)
  const [openAccordionItem, setOpenAccordionItem] = useState<string | undefined>()
  const [highlightedItem, setHighlightedItem] = useState<string | undefined>()
  const searchParams = useSearchParams()
  
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Handle URL parameter for specific FAQ item
  useEffect(() => {
    const itemId = searchParams.get('item')
    if (itemId) {
      // Find the FAQ item and its position
      const faqItem = faqData.find(item => item.id === itemId)
      if (faqItem) {
        // Find which category and item index this belongs to
        let categoryIndex = -1
        let itemIndex = -1
        
        for (let i = 0; i < transformedFaqData.length; i++) {
          const category = transformedFaqData[i]
          const foundItemIndex = category.items.findIndex(item => item.id === itemId)
          if (foundItemIndex !== -1) {
            categoryIndex = i
            itemIndex = foundItemIndex
            break
          }
        }
        
        if (categoryIndex !== -1 && itemIndex !== -1) {
          const accordionValue = `item-${categoryIndex}-${itemIndex}`
          setOpenAccordionItem(accordionValue)
          setHighlightedItem(accordionValue)
          
          // Scroll to the specific FAQ item after a short delay
          setTimeout(() => {
            const element = document.getElementById(`faq-item-${itemId}`)
            if (element) {
              element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              })
            }
          }, 500)
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedItem(undefined)
          }, 3000)
        }
      }
    }
  }, [searchParams])

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <HelpFaqSkeleton />
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
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Frequently Asked Questions</h1>
              <p className="text-muted-foreground">Find answers to common questions about support and services</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {transformedFaqData.map((category, categoryIndex) => (
                <Card key={categoryIndex}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      {category.category}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion 
                      type="single" 
                      collapsible 
                      className="w-full"
                      value={openAccordionItem}
                      onValueChange={setOpenAccordionItem}
                    >
                      {category.items.map((item, itemIndex) => {
                        const accordionValue = `item-${categoryIndex}-${itemIndex}`
                        const isHighlighted = highlightedItem === accordionValue
                        
                        return (
                          <AccordionItem 
                            key={itemIndex} 
                            value={accordionValue}
                            id={`faq-item-${item.id}`}
                            className={isHighlighted ? "ring-2 ring-primary ring-offset-2 rounded-lg transition-all duration-500" : ""}
                          >
                            <AccordionTrigger className="text-left">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {item.answer}
                            </AccordionContent>
                          </AccordionItem>
                        )
                      })}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                  <CardDescription>
                    Get help faster with these quick options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 flex flex-col gap-1">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setIsNewTicketDialogOpen(true)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Submit New Ticket
                  </Button>
                  <Link href="/forms/my-tickets">
                    <Button variant="outline" className="w-full justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      View My Tickets
                    </Button>
                  </Link>
                  <Link href="/help/contact">
                    <Button variant="outline" className="w-full justify-start">
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Contact Support
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Need More Help?</CardTitle>
                  <CardDescription>
                    Can&apos;t find what you&apos;re looking for?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">24/7 Support Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Response within 24-48 hours</span>
                  </div>
                  <div>
                  <Link href="/help/contact">
                    <Button className="w-full">
                      Contact Support Team
                    </Button>
                  </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
      
      {/* New Ticket Dialog */}
      <NewTicketDialog 
        open={isNewTicketDialogOpen} 
        onOpenChange={setIsNewTicketDialogOpen} 
      />
    </SidebarProvider>
  )
} 