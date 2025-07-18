"use client"

import { useState, useEffect } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { NewTicketSkeleton } from "@/components/skeleton-loaders"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Send, CheckCircle, FileText, Mail, Phone, Upload, X, AlertTriangle, MessageSquare } from "lucide-react"
import Link from "next/link"
import { addTicketForUser, getCurrentUser } from "@/lib/ticket-utils"
import { getCurrentUserProfile } from "@/lib/user-profiles"


export default function NewTicketPage() {
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [fileError, setFileError] = useState<string>("")
  const [userProfile, setUserProfile] = useState<any>(null)
  
  // Maximum file size: 10MB
  const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB in bytes

  // Simulate loading and get user profile
  useEffect(() => {
    const timer = setTimeout(() => {
      const profile = getCurrentUserProfile()
      setUserProfile(profile)
      setLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Reset form state when component mounts (for "Create Another Ticket")
  useEffect(() => {
    setIsSubmitted(false)
    setTicketId("")
    setFiles([])
    setFileError("")
  }, [])

  const generateTicketId = () => {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 5)
    return `TKT-${timestamp}-${random}`.toUpperCase()
  }

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
    
    const formData = new FormData(e.currentTarget)
    const newTicketId = generateTicketId()
    const currentDate = new Date()
    
    // Get user info from session/profile
    const fullName = userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Unknown User'
    const userEmail = userProfile?.email || getCurrentUser()?.email || 'unknown@email.com'
    
    const ticket = {
      id: newTicketId,
      name: fullName, // Auto-populated from user session
      date: currentDate.toISOString().split('T')[0], // Auto-set to submission date
      concern: formData.get('concern') as string,
      comments: formData.get('comments') as string,
      category: formData.get('category') as string,
      details: formData.get('details') as string,
      email: userEmail, // Auto-populated from user session
      files: files.map(file => file.name),
      status: 'pending' as const,
      createdAt: currentDate.toISOString()
    }
    
    // Save to user-specific localStorage
    const currentUser = getCurrentUser()
    if (currentUser) {
      addTicketForUser(currentUser.email, ticket)
    }
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setTicketId(newTicketId)
    setIsSubmitted(true)
    setIsSubmitting(false)
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
                  <CardDescription className="text-lg">
                    Your support ticket has been created and is now in our system
                  </CardDescription>
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
                        <p className="text-sm">You'll receive an email confirmation shortly</p>
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
                    <Link href="/dashboard" className="flex-1 sm:flex-none">
                      <Button variant="outline" className="w-full sm:w-auto">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                      </Button>
                    </Link>
                    <Button 
                      onClick={() => {
                        setIsSubmitted(false)
                        setTicketId("")
                        setFiles([])
                        setFileError("")
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
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
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
                  
                  {/* User Info Display (Read-only) */}
                  {userProfile && (
                    <div className="bg-muted/50 rounded-lg p-4 border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1 bg-primary/10 rounded">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm">Ticket Information</h3>
                      </div>
                      <div className="grid gap-3 text-sm">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Submitted by:</span>
                            <span className="font-medium">
                              {userProfile.first_name} {userProfile.last_name}
                            </span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                            <span className="font-medium break-all text-xs sm:text-sm">{userProfile.email}</span>
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Submission Date:</span>
                            <span className="font-medium">{new Date().toLocaleDateString()}</span>
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="text-muted-foreground whitespace-nowrap">Department:</span>
                            <span className="font-medium">{userProfile.department}</span>
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

                  {/* Ticket Comments */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="comments">Ticket Comments *</Label>
                      <Textarea 
                        id="comments" 
                        name="comments"
                        placeholder="Provide detailed comments about your issue..."
                        rows={4}
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
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="computer">Computer/Equipment</SelectItem>
                          <SelectItem value="station">Station</SelectItem>
                          <SelectItem value="surroundings">Surroundings</SelectItem>
                          <SelectItem value="schedule">Schedule</SelectItem>
                          <SelectItem value="compensation">Compensation</SelectItem>
                          <SelectItem value="transport">Transport</SelectItem>
                          <SelectItem value="suggestion">Suggestion</SelectItem>
                          <SelectItem value="checkin">Check-in (chat with account manager)</SelectItem>
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

                  {/* File Upload */}
                  <div className="space-y-4">
                    <Label>Supporting Information (drag and drop files, images)</Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 sm:p-6 text-center transition-colors cursor-pointer ${
                        dragActive 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                      }`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('file-upload')?.click()}
                    >
                      <Upload className="mx-auto h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground mb-2" />
                      <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                        Drag and drop files here, or click to select
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Maximum file size: 10MB per file
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                        accept="image/*,.pdf,.doc,.docx,.txt"
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation()
                          document.getElementById('file-upload')?.click()
                        }}
                      >
                        Choose Files
                      </Button>
                    </div>
                    
                    {/* File Error */}
                    {fileError && (
                      <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                        {fileError}
                      </div>
                    )}
                    
                    {/* File List */}
                    {files.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Files:</Label>
                        <div className="space-y-2">
                          {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {file.name}
                                  </span>
                                  <span className="text-xs text-muted-foreground flex-shrink-0">
                                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                  </span>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="flex-shrink-0"
                                onClick={() => removeFile(index)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
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