"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, Shield, Lock } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { getCurrentUser } from "@/lib/ticket-utils"
import { authHelpers } from "@/lib/supabase"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { PasswordSettingsSkeleton } from "@/components/skeleton-loaders"

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Get current user on component mount
  useEffect(() => {
    const user = getCurrentUser()
    setCurrentUser(user)
    // Simulate initial loading
    const timer = setTimeout(() => {
      setIsInitializing(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const validatePassword = (password: string) => {
    const minLength = 8
    const hasUpperCase = /[A-Z]/.test(password)
    const hasLowerCase = /[a-z]/.test(password)
    const hasNumbers = /\d/.test(password)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    return {
      isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (!currentUser?.email) {
      setError("User not found. Please log in again.")
      setLoading(false)
      return
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match")
      setLoading(false)
      return
    }

    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.isValid) {
      setError("New password does not meet requirements")
      setLoading(false)
      return
    }

    try {
      // First, verify the current password by attempting to sign in
      const { error: verifyError } = await authHelpers.signInWithEmail(
        currentUser.email,
        currentPassword
      )

      if (verifyError) {
        setError("Current password is incorrect")
        setLoading(false)
        return
      }

      // Update the password using Supabase
      const { error: updateError } = await authHelpers.updateUser({
        password: newPassword
      })

      if (updateError) {
        setError(`Password update failed: ${updateError.message}`)
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/settings/profile')
      }, 3000)

    } catch (err) {
      console.error("Password change error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const passwordValidation = validatePassword(newPassword)

  if (isInitializing) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <PasswordSettingsSkeleton />
        </SidebarInset>
      </SidebarProvider>
    )
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
                  <CardTitle className="text-xl">Password Changed Successfully</CardTitle>
                  <CardDescription>
                    Your password has been successfully updated. You will be redirected to your profile page shortly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Button 
                    onClick={() => router.push('/settings/profile')}
                    className="w-full"
                  >
                    Go to Profile
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
                <h1 className="text-3xl font-bold text-foreground">Password Settings</h1>
                <p className="text-muted-foreground">Update your account password securely</p>
              </div>
          </div>

          <div className="flex items-center justify-center">
            <Card className="w-full max-w-md bg-card">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-2xl">Update Password</CardTitle>
                <CardDescription>
                  Enter your current password and choose a new secure password
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Current Password */}
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        className="pr-10"
                        required
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        disabled={loading}
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new password"
                        className="pr-10"
                        required
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        disabled={loading}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        className="pr-10"
                        required
                        disabled={loading}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={loading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Password Requirements */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Password Requirements:</Label>
                    <div className="space-y-1 text-xs">
                      <div className={`flex items-center gap-2 ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordValidation.minLength ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        At least 8 characters
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordValidation.hasUpperCase ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        One uppercase letter
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordValidation.hasLowerCase ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        One lowercase letter
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasNumbers ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordValidation.hasNumbers ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        One number
                      </div>
                      <div className={`flex items-center gap-2 ${passwordValidation.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                        {passwordValidation.hasSpecialChar ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        One special character
                      </div>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Button 
                    variant="link" 
                    onClick={() => router.push('/settings/profile')}
                    className="text-sm"
                  >
                    Back to Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
