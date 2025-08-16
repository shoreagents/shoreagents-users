"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react"
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState("")
  const [type, setType] = useState("")
  const [hasValidToken, setHasValidToken] = useState(false)
  const [isCheckingToken, setIsCheckingToken] = useState(true)

  useEffect(() => {
    // Extract token and type from URL parameters
    // Supabase might use either 'token' or 'access_token'
    const urlToken = searchParams.get('token') || searchParams.get('access_token')
    const urlType = searchParams.get('type')
    
    if (urlToken && urlType) {
      setToken(urlToken)
      setType(urlType)
      setHasValidToken(true)
      console.log('Token received:', urlToken)
      console.log('Type received:', urlType)
    } else {
      // No URL parameters, show error
      console.log('No URL parameters found')
      setError("Invalid reset link. Please use the link from your email.")
      setHasValidToken(false)
    }
    
    setIsCheckingToken(false)
  }, [searchParams])

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

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      setError("Password does not meet requirements")
      setLoading(false)
      return
    }

    try {
      // First verify the recovery token
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'recovery'
      })

      if (verifyError) {
        console.error("Token verification error:", verifyError)
        setError(`Token verification failed: ${verifyError.message}`)
        setLoading(false)
        return
      }

      // Then update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        console.error("Password update error:", updateError)
        setError(`Password update failed: ${updateError.message}`)
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 3000)

    } catch (err) {
      console.error("Password reset error:", err)
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const passwordValidation = validatePassword(password)

  // Show loading while checking for token
  if (isCheckingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-xl">Checking Reset Link</CardTitle>
            <CardDescription>
              Verifying your password reset link...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-xl">Password Reset Successful</CardTitle>
            <CardDescription>
              Your password has been successfully reset. You will be redirected to the login page shortly.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button 
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl">Invalid Reset Link</CardTitle>
            <CardDescription>
              {error || "This reset link is invalid or has expired. Please request a new password reset."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Button 
              onClick={() => router.push('/forgot-password')}
              className="w-full"
            >
              Request New Reset
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="relative w-full rounded-lg border border-red-500/50 text-red-600 p-4">
                <div className="text-sm">{error}</div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
              disabled={loading || !password || !confirmPassword}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                "Reset Password"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Button 
              variant="link" 
              onClick={() => router.push('/login')}
              className="text-sm"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 