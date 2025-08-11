"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActivity } from "@/contexts/activity-context"
import { getCurrentPhilippinesTime } from "@/lib/timezone-utils"
import { setAuthCookie } from "@/lib/auth-utils"
import { authHelpers, supabase } from "@/lib/supabase"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { setUserLoggedIn } = useActivity()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Sign in with Supabase
      const { data, error } = await authHelpers.signInWithEmail(email, password)
      
      if (error) {
        // If Supabase is not configured, fallback to Railway system
        if (error.message.includes('SUPABASE') || error.message.includes('supabaseKey')) {
          // Fallback to Railway authentication
          const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, fallback: true }),
          })

          const fallbackData = await response.json()
          
          if (fallbackData.success && fallbackData.user) {
            // Store authentication data with fallback flag
            const authData = {
              isAuthenticated: true,
              user: {
                id: fallbackData.user.id,
                email: fallbackData.user.email,
                name: fallbackData.user.name,
                role: fallbackData.user.role,
                user_type: fallbackData.user.user_type
              },
              timestamp: getCurrentPhilippinesTime(),
              usingFallback: true
            }

            setAuthCookie(authData, 7)
            localStorage.setItem("shoreagents-auth", JSON.stringify(authData))
            setUserLoggedIn()
            // Navigate immediately after setting auth cookie/localStorage
            router.replace("/dashboard")
            return
          } else {
            setError(fallbackData.error || "Login failed. Please try again.")
            setIsLoading(false)
            return
          }
        }
        
        setError(error.message || "Login failed. Please try again.")
        setIsLoading(false)
        return
      }

      if (data.user && data.session) {
        // Call the API route for hybrid validation (Supabase auth + Railway role check)
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        })

        const validationData = await response.json()
        
        if (validationData.success && validationData.user) {
          // Store authentication data with hybrid information
          const authData = {
            isAuthenticated: true,
            user: {
              id: validationData.user.id, // Supabase UUID
              railway_id: validationData.user.railway_id, // Railway ID for compatibility
              email: validationData.user.email,
              name: validationData.user.name,
              role: validationData.user.role,
              user_type: validationData.user.user_type
            },
            timestamp: getCurrentPhilippinesTime(),
            hybrid: true // Flag to indicate hybrid authentication
          }

          // Set cookie using the new utility function
          setAuthCookie(authData, 7)
          
          // Store same minimal data in localStorage for client-side access
          localStorage.setItem("shoreagents-auth", JSON.stringify(authData))

          // Start activity tracking for the logged-in user
          setUserLoggedIn()

          // Navigate immediately after setting auth cookie/localStorage
          router.replace("/dashboard")
        } else {
          // Validation failed - sign out from Supabase
          await authHelpers.signOut()
          setError(validationData.error || "Access denied. Please contact administrator.")
          setIsLoading(false)
        }
      }
    } catch (error) {
      setError("Network error. Please check your connection and try again.")
    }

    setIsLoading(false)
  }

  return (
    <Card className={cn("w-full max-w-md", className)} {...props}>
      <CardHeader className="space-y-1">
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center justify-center">
            <img 
              src="https://www.shoreagents.com/wp-content/uploads/2023/04/ShoreAgents-Logo.png" 
              alt="ShoreAgents Logo" 
              className="h-16 w-auto"
            />
              </div>
          <div className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Welcome to ShoreAgents</CardTitle>
            <CardDescription>
              Sign in to your agent dashboard
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
              placeholder="agent@shoreagents.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {showPassword ? "Hide password" : "Show password"}
                </span>
              </Button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
          </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          
          <div className="text-center mt-4">
            <Button 
              type="button" 
              variant="link" 
              onClick={() => router.push('/forgot-password')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Forgot your password?
            </Button>
          </div>
      </form>
      </CardContent>
    </Card>
  )
}
