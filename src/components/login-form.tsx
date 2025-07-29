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

  const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Call the authentication API
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
    
      if (data.success && data.user) {
        // Store MINIMAL authentication state - no personal info
      const authData = {
        isAuthenticated: true,
        user: {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name, // Just for display, can be fetched fresh
            role: data.user.role, // For compatibility 
            user_type: data.user.user_type // For role-based access
        },
        timestamp: getCurrentPhilippinesTime()
      }

        // Set cookie for middleware (minimal data)
      setCookie("shoreagents-auth", JSON.stringify(authData), 7)
      
        // Store same minimal data in localStorage for client-side access
      localStorage.setItem("shoreagents-auth", JSON.stringify(authData))

      // Start activity tracking for the logged-in user
      setUserLoggedIn()

      // Redirect to dashboard
      router.push("/dashboard")
    } else {
        // Handle different types of errors
        if (response.status === 403) {
          // Access denied for non-agent users
          setError("Access denied. This application is restricted to Agent users only.")
        } else {
          // General authentication errors
          setError(data.error || "Login failed. Please try again.")
        }
      }
    } catch (error) {
      console.error('Login error:', error)
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

          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">Demo Credentials (Agent Users Only):</p>
            <div className="space-y-1">
              <div>
                <p className="text-xs">
                  Agent 1: <code className="bg-muted px-1 rounded">agent@shoreagents.com</code>
                </p>
                <p className="text-xs">
                  Agent 2: <code className="bg-muted px-1 rounded">agent0@shoreagents.com</code>
                </p>
                <p className="text-xs">
                  Password: <code className="bg-muted px-1 rounded">shoreagents123</code>
                </p>
                <p className="text-xs text-amber-600">
                  Note: Only Agent users can access this application
                </p>
              </div>
          </div>
        </div>
      </form>
      </CardContent>
    </Card>
  )
}
