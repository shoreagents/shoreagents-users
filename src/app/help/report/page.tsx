"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Bug, AlertTriangle, CheckCircle, XCircle, Send, FileText, User, Settings, Activity, Coffee } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/ticket-utils"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function ReportPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  
  // Form state
  const [reportType, setReportType] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  // Get current user on component mount
  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
  }, [])

  const reportTypes = [
    { value: "bug", label: "Bug Report", icon: Bug, description: "Report a technical issue or error" },
    { value: "feature", label: "Feature Request", icon: FileText, description: "Suggest a new feature or improvement" },
    { value: "ui", label: "UI/UX Issue", icon: Settings, description: "Report interface or user experience problems" },
    { value: "performance", label: "Performance Issue", icon: Activity, description: "Report slow loading or performance problems" },
    { value: "account", label: "Account Issue", icon: User, description: "Report problems with your account or login" },
    { value: "other", label: "Other", icon: AlertTriangle, description: "Report any other issues or concerns" }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!currentUser?.email) {
      setError("User not found. Please log in again.")
      setLoading(false)
      return
    }

    if (!reportType || !title || !description) {
      setError("Please fill in all required fields.")
      setLoading(false)
      return
    }

    try {
      // Submit report to API
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType,
          title,
          description
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report')
      }

      if (data.success) {
        setSuccess(true)
        
        // Reset form after successful submission
        setReportType("")
        setTitle("")
        setDescription("")
        
        setTimeout(() => {
          router.push('/settings/profile')
        }, 3000)
      } else {
        setError(data.error || 'Failed to submit report')
      }

    } catch (err) {
      console.error('Report submission error:', err)
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setReportType("")
    setTitle("")
    setDescription("")
    setError("")
    setSuccess(false)
  }

  if (success) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <div className="flex flex-1 flex-col gap-8 p-8 pt-4 min-h-screen bg-background">
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <CardTitle className="text-xl">Report Submitted Successfully</CardTitle>
                  <CardDescription>
                    Thank you for your report. Our team will review it and get back to you soon.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Button 
                    onClick={() => router.push('/settings/profile')}
                    className="w-full"
                  >
                    Back to Settings
                  </Button>
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
        <div className="flex flex-1 flex-col gap-8 p-8 pt-4 min-h-screen bg-background">
          <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Report Issues</h1>
                <p className="text-muted-foreground">Help us improve by reporting bugs, problems, or errors you encounter</p>
              </div>
          </div>

          <div className="flex items-start">
            <Card className="w-full bg-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <Bug className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">Submit a Report</CardTitle>
                    <CardDescription>
                      Provide detailed information to help us understand and resolve the issue
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Report Type */}
                  <div className="space-y-2">
                    <Label htmlFor="reportType">Report Type *</Label>
                    <Select value={reportType} onValueChange={setReportType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select the type of report" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportTypes.map((type) => {
                          const IconComponent = type.icon
                          return (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <IconComponent className="h-4 w-4" />
                                <div>
                                  <div className="font-medium">{type.label}</div>
                                  <div className="text-xs text-muted-foreground">{type.description}</div>
                                </div>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Title */}
                  <div className="space-y-2">
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Brief description of the issue"
                      required
                      disabled={loading}
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description *</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide a detailed description of the issue..."
                      rows={4}
                      required
                      disabled={loading}
                    />
                  </div>

                  {/* User Information removed by request */}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button 
                      type="submit" 
                      className="flex-1" 
                      disabled={loading || !reportType || !title || !description}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting Report...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Submit Report
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
