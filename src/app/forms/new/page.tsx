"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { NewTicketSkeleton } from "@/components/skeleton-loaders"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Send, CheckCircle, FileText, Mail, Phone, Upload, X, AlertTriangle, MessageSquare } from "lucide-react"
import Link from "next/link"
import { getCurrentUser } from "@/lib/ticket-utils"
import { addSmartNotification } from "@/lib/notification-service"

// Interface for uploaded files
interface UploadedFile {
  name: string
  url: string
  size: number
  type: string
}

export default function NewTicketPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [fileError, setFileError] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<Array<{id: number, name: string}>>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  
  // Maximum file size: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

  // Fetch categories only
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesResponse = await fetch('/api/ticket-categories', {
          credentials: 'include'
        })
        
        if (categoriesResponse.ok) {
          const categoriesData = await categoriesResponse.json()
          if (categoriesData.success) {
            setCategories(categoriesData.categories)
          } else {
            console.error('Failed to load categories:', categoriesData.error)
          }
        } else {
          console.error('Failed to load categories')
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
        setCategoriesLoading(false)
      }
    }

    fetchData()
  }, [])

  // Reset form state when component mounts (for "Create Another Ticket")
  useEffect(() => {
    const resetFormState = () => {
      setIsSubmitted(false)
      setTicketId("")
      setFiles([])
      setUploadedFiles([]) // Reset uploaded files state
      setFileError("")
      setDragActive(false)
      setIsSubmitting(false)
      setUploadingFiles(false)
    }
    
    resetFormState()
  }, [])

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const validateFile = (file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File "${file.name}" is too large. Maximum size is 10MB.`)
      return false
    }
    setFileError("")
    return true
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files)
      const validFiles = newFiles.filter(validateFile)
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
      const validFiles = newFiles.filter(validateFile)
      setFiles(prev => [...prev, ...validFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Capture files at the beginning to avoid state changes during async operations
    const filesToUpload = [...files]
    
    // Only set uploading files state if there are actually files to upload
    if (filesToUpload.length > 0) {
      setUploadingFiles(true)
    }
    
    try {
      const formData = new FormData(e.currentTarget)
      
      // Get user info from session/profile with fallbacks
      const currentUser = getCurrentUser()
      const fullName = currentUser?.name || 'Unknown User'
      const userEmail = currentUser?.email || 'unknown@email.com'
      
      // First, create the ticket to get the ticket ID
      const ticketData = {
        name: fullName,
        concern: formData.get('concern') as string,
        category: formData.get('category') as string,
        details: formData.get('details') as string,
        files: [] // We'll update this after uploading files
      }
      
      // Submit ticket to API first
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(ticketData)
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create ticket')
      }
      
      const result = await response.json()
      const newTicketId = result.ticket.id
      
      // Now upload files to Supabase storage using server-side API
      if (filesToUpload.length > 0) {
        console.log('📤 Uploading files to Supabase storage...')
        
        // Create FormData for file upload
        const uploadFormData = new FormData()
        uploadFormData.append('ticketId', newTicketId)
        
        // Add all files to FormData
        filesToUpload.forEach(file => {
          uploadFormData.append('files', file)
        })
        
        // Upload files using server-side API
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: uploadFormData
        })
        
        if (uploadResponse.ok) {
          const uploadResult = await uploadResponse.json()
          if (uploadResult.success) {
            setUploadedFiles(uploadResult.files)
            
            // Update the ticket with the uploaded file URLs
            const updateResponse = await fetch(`/api/tickets/${newTicketId}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              credentials: 'include',
              body: JSON.stringify({
                supporting_files: uploadResult.files.map((file: any) => file.url),
                file_count: uploadResult.files.length
              })
            })
            
            if (!updateResponse.ok) {
              const errorData = await updateResponse.json()
              console.error('❌ Failed to update ticket with file URLs:', errorData)
              console.error('❌ Response status:', updateResponse.status)
              console.error('❌ Uploaded files:', uploadResult.files)
            } else {
              const updateResult = await updateResponse.json()
              console.log('✅ Successfully updated ticket with file URLs:', updateResult)
            }
          } else {
            console.warn('Failed to upload files, but ticket was created')
          }
        } else {
          console.warn('Failed to upload files, but ticket was created')
        }
      }
      
      if (result.success) {
        // Notification now handled server-side via database + sockets
        
        // Save ticket ID for success display
        setTicketId(result.ticket.id)
        setIsSubmitted(true)
      } else {
        throw new Error(result.error || 'Failed to create ticket')
      }
      
    } catch (error) {
      console.error('❌ Error creating ticket:', error)
      alert(`Error creating ticket: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
      setUploadingFiles(false)
    }
  }

  if (loading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <NewTicketSkeleton />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  if (isSubmitted) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-6 p-6 pt-2">
            
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="max-w-2xl w-full border-2 border-primary/20 shadow-xl">
                <CardHeader className="text-center pb-6">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-pulse">
                    <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold text-primary mb-2">
                    Ticket Submitted Successfully!
                  </CardTitle>
                  <p className="text-lg">
                    Your support ticket has been created and is now in our system
                  </p>
                </CardHeader>
                
                <CardContent className="space-y-8">
                  {/* Ticket ID Section */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-full px-6 py-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-mono font-semibold text-primary">
                        {ticketId}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Please save this ticket ID for future reference
                    </p>
                  </div>

                  {/* Next Steps Section */}
                  <div className="bg-gradient-to-br from-primary/5 to-secondary/5 rounded-xl p-6 border border-primary/10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MessageSquare className="h-5 w-5 text-primary" />
                      </div>
                      <h4 className="font-semibold text-lg">What happens next?</h4>
                    </div>
                    <div className="grid gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                        <p className="text-sm">Your ticket has been assigned to our support team</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                        <p className="text-sm">Our team will review and respond within 24-48 hours</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                        <p className="text-sm">You can track your ticket status in the dashboard</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link href="/forms/my-tickets" className="flex-1 sm:flex-none">
                      <Button variant="outline" className="w-full sm:w-auto">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        View All My Tickets
                      </Button>
                    </Link>
                    <Button 
                      onClick={() => {
                        // Comprehensive reset of all form states
                        setIsSubmitted(false)
                        setTicketId("")
                        setFiles([])
                        setUploadedFiles([]) // Reset uploaded files when creating another ticket
                        setFileError("")
                        setDragActive(false)
                        setIsSubmitting(false)
                        setUploadingFiles(false)
                      }}
                      className="w-full sm:w-auto bg-primary hover:bg-primary/90"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Create Another Ticket
                    </Button>
                  </div>

                  {/* Additional Info */}
                  <div className="text-center pt-4 border-t border-border/50">
                    <p className="text-sm text-muted-foreground">
                      Need immediate assistance? Contact our support team at{' '}
                      <a href="mailto:support@shoreagents.com" className="text-primary hover:underline">
                        support@shoreagents.com
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
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
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">New Support Ticket</h1>
              <p className="text-muted-foreground">Submit a support request to our team</p>
            </div>
          </div>
          
          
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Support Ticket Form</CardTitle>
                      <CardDescription>
                        Please provide detailed information about your issue. This helps us assist you more effectively.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* User Info Display Section */}
                  {(getCurrentUser()) && (
                    <div className="bg-muted/30 rounded-lg p-4 border border-muted">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm">Ticket Information</h3>
                      </div>
                      <div className="grid gap-3 text-sm">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Submitted by:</span>
                            <span className="font-medium">
                              {getCurrentUser()?.name || 'Unknown User'}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                            <span className="font-medium break-all text-xs sm:text-sm">
                              {getCurrentUser()?.email || 'unknown@email.com'}
                            </span>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Submission Date:</span>
                            <span className="font-medium">{new Date().toLocaleDateString()}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Department:</span>
                            <span className="font-medium">
                              Agent
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="concern">Concern *</Label>
                      <Textarea 
                        id="concern" 
                        name="concern"
                        placeholder="Briefly describe your concern..."
                        rows={3}
                        required
                      />
                    </div>
                  </div>



                  {/* Category */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">What is your support ticket related to? *</Label>
                      <Select name="category" required>
                        <SelectTrigger>
                          <SelectValue placeholder={categoriesLoading ? "Loading categories..." : "Select a category"} />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="details">Explain in more detail if needed</Label>
                      <Textarea 
                        id="details" 
                        name="details"
                        placeholder="Provide additional context, specific details, or any other information that might help us understand your situation better..."
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* File Upload Section */}
                  <div className="space-y-4">
                    <Label htmlFor="files">Supporting Files (Optional)</Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary hover:bg-primary/5 ${
                        dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('files')?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          document.getElementById('files')?.click()
                        }
                      }}
                    >
                      <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        Drag and drop files here, or click anywhere to select
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Maximum file size: 10MB. Supported formats: Images, PDF, Word, Excel, PowerPoint, Text, ZIP
                      </p>
                      <input
                        id="files"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          document.getElementById('files')?.click()
                        }}
                      >
                        Select Files
                      </Button>
                    </div>

                    {/* File List */}
                    {files.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Files ({files.length})</Label>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Upload Progress */}
                    {uploadingFiles && (
                      <div className="space-y-2">
                        <Label>Uploading Files...</Label>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary animate-pulse" style={{ width: '100%' }}></div>
                          </div>
                          <span className="text-sm text-muted-foreground">Processing...</span>
                        </div>
                      </div>
                    )}

                    {/* Uploaded Files */}
                    {uploadedFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label>Uploaded Files ({uploadedFiles.length})</Label>
                        <div className="space-y-2">
                          {uploadedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-md">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                <span className="text-sm">{file.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                View
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {fileError && (
                      <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">{fileError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t">
                    <Link href="/dashboard" className="w-full sm:w-auto">
                      <Button type="button" variant="outline" className="w-full sm:w-auto">
                        Cancel
                      </Button>
                    </Link>
                    <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto min-w-[140px]">
                      {isSubmitting ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {uploadingFiles ? 'Uploading Files...' : 'Submitting...'}
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Submit Ticket
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Important Notes */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm">Important Notes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>Please provide as much detail as possible to help us assist you quickly</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>For technical issues, include error messages and screenshots if possible</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>We typically respond within 24-48 hours during business days</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2 flex-shrink-0"></div>
                    <p>You&apos;ll receive a unique ticket ID for tracking your request</p>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Need Help?</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    If you need immediate assistance, please contact our support team directly.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>support@shoreagents.com</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>+1 (555) 123-4567</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 