"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Send, CheckCircle, FileText, Mail, Phone, Upload, X, AlertTriangle, MessageSquare } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getCurrentUser } from "@/lib/ticket-utils"
import { useCreateTicket } from "@/hooks/use-tickets"

// Interface for uploaded files
interface UploadedFile {
  name: string
  url: string
  size: number
  type: string
}

interface NewTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [fileError, setFileError] = useState<string>('')
  const [categories, setCategories] = useState<Array<{id: number, name: string}>>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    concern: '',
    category: '',
    details: ''
  })
  const formRef = useRef<HTMLFormElement>(null)
  
  // Use React Query for creating tickets
  const createTicketMutation = useCreateTicket()
  
  // Maximum file size: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

  // Check if form is valid (at least concern and category are filled)
  const isFormValid = formData.concern.trim() !== '' && formData.category !== ''

  // Handle form field changes
  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setIsSubmitted(false)
      setTicketId("")
      setFiles([])
      setUploadedFiles([])
      setFileError("")
      setDragActive(false)
      setUploadingFiles(false)
      setIsSubmitting(false)
      setFormData({
        concern: '',
        category: '',
        details: ''
      })
    }
  }, [open])

  // Auto-redirect to my tickets page after successful submission
  useEffect(() => {
    if (isSubmitted && ticketId) {
      const timer = setTimeout(() => {
        onOpenChange(false) // Close dialog first
        window.location.href = '/forms/my-tickets' // Then redirect
      }, 2000) // Redirect after 2 seconds
      
      return () => clearTimeout(timer)
    }
  }, [isSubmitted, ticketId, onOpenChange])

  // Fetch categories when dialog opens
  useEffect(() => {
    if (open) {
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
           setCategoriesLoading(false)
         }
      }

      fetchData()
    }
  }, [open])

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
      
      // First, create the ticket to get the ticket ID
      const ticketData = {
        concern: formData.get('concern') as string,
        category: formData.get('category') as string,
        details: formData.get('details') as string,
        files: [] // We'll update this after uploading files
      }
      
      // Use React Query mutation to create ticket
      const result = await createTicketMutation.mutateAsync(ticketData)
      const newTicketId = result.ticket.id
      
      // Handle file uploads and ticket updates
      if (filesToUpload.length > 0) {
        setUploadingFiles(true)
        
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
              console.error('Failed to update ticket with file URLs:', errorData)
              console.error('Response status:', updateResponse.status)
              console.error('Uploaded files:', uploadResult.files)
            } 
          } else {
            console.warn('Failed to upload files, but ticket was created')
          }
        } else {
          console.warn('Failed to upload files, but ticket was created')
        }
      } else {
        // For tickets without attachments, still call PATCH to trigger notification
        const updateResponse = await fetch(`/api/tickets/${newTicketId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            supporting_files: [],
            file_count: 0
          })
        })
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json()
          console.error('Failed to update ticket for notification:', errorData)
        }
      }
      
      if (result.success) {
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
      setUploadingFiles(false)
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
    }
  }


  return (
    <>
      {/* Main Dialog */}
      <Dialog open={open && !isSubmitted} onOpenChange={handleClose}>
        <DialogContent className="max-w-3xl w-full h-[90vh] flex flex-col p-0">
          {/* Fixed Header */}
           <DialogHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
             <div className="flex items-center justify-between">
               <div>
                 <DialogTitle className="text-2xl font-bold">New Support Ticket</DialogTitle>
                 <DialogDescription>Submit a support request to our team</DialogDescription>
               </div>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={handleClose}
                 className="h-8 w-8 p-0"
                 disabled={isSubmitting}
               >
                 <X className="h-4 w-4" />
               </Button>
             </div>
           </DialogHeader>
          
           {/* Scrollable Content */}
           <ScrollArea className="flex-1 ">
             <div className="space-y-6">
             {/* Main Form */}
             <div className="space-y-6">
              <Card className="border-none">
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
                  <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
                  

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
                        value={formData.concern}
                        onChange={(e) => handleFieldChange('concern', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">What is your support ticket related to? *</Label>
                      <Select 
                        name="category" 
                        required
                        value={formData.category}
                        onValueChange={(value) => handleFieldChange('category', value)}
                      >
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
                        value={formData.details}
                        onChange={(e) => handleFieldChange('details', e.target.value)}
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

                </form>
              </CardContent>
            </Card>
            </div>
            </div>
           </ScrollArea>
          
           {/* Fixed Footer with Buttons */}
           <div className="px-6 py-4 border-t bg-background flex-shrink-0">
             <div className="flex flex-col sm:flex-row gap-4 justify-end">
               <Button type="button" variant="outline" onClick={handleClose} className="w-full sm:w-auto hover:text-red-500 hover:!border-red-500">
                 Cancel
               </Button>
               <Button 
                 type="button" 
                 disabled={isSubmitting || !isFormValid} 
                 className="w-full sm:w-auto min-w-[140px]"
                 onClick={() => {
                   if (formRef.current) {
                     formRef.current.requestSubmit()
                   }
                 }}
               >
                 {isSubmitting ? (
                   <>
                     <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                     Submitting...
                   </>
                 ) : (
                   <>
                     <Send className="mr-2 h-4 w-4" />
                     Submit Ticket
                   </>
                 )}
               </Button>
             </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={isSubmitted} onOpenChange={() => {}}>
        <DialogContent className="max-w-2xl w-full border-2 border-primary/20 shadow-xl">
          <DialogHeader className="text-center pb-6">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 animate-pulse">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-3xl font-bold text-primary mb-2 text-center">
              Ticket Submitted Successfully!
            </DialogTitle>
            <DialogDescription className="text-lg">
              Your support ticket has been created and is now in our system
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8">
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

            {/* Additional Info */}
            <div className="text-center pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Need immediate assistance? Contact our support team at{' '}
                <a href="mailto:support@shoreagents.com" className="text-primary hover:underline">
                  support@shoreagents.com
                </a>
              </p>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
