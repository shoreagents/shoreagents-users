"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { FileText, Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useActivity } from "@/contexts/activity-context"
import { getCurrentPhilippinesTime } from "@/lib/timezone-utils"
import { setAuthCookie, clearAllAuthArtifacts } from "@/lib/auth-utils"
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

  // Proactively clear any stale tokens/cookies when arriving at the login page
  useEffect(() => {
    clearAllAuthArtifacts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Single-call login flow handled entirely on the server to avoid races
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (!response.ok || !data?.success || !data?.user) {
        setError(data?.error || 'Login failed. Please try again.')
        setIsLoading(false)
        return
      }

      // Mirror server cookie to localStorage for client access
      const authData = {
        isAuthenticated: true,
        user: {
          id: data.user.id,
          railway_id: data.user.railway_id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          user_type: data.user.user_type
        },
        timestamp: getCurrentPhilippinesTime(),
        hybrid: !!data.hybrid || !!data.fallback
      }

      // Optional: set client cookie duplicate (server already set); harmless if duplicated
      setAuthCookie(authData, 7)
      localStorage.setItem('shoreagents-auth', JSON.stringify(authData))
      setUserLoggedIn()

      // Emit login event to socket server
      try {
        const event = new CustomEvent('user-login', { 
          detail: { 
            user: authData.user,
            timestamp: new Date().toISOString(),
            reason: 'manual_login'
          } 
        });
        window.dispatchEvent(event);
        
        // Also dispatch login event for user status tracking
        const loginEvent = new CustomEvent('user-login', { 
          detail: { 
            email: email,
            timestamp: new Date().toISOString(),
            reason: 'manual_login'
          } 
        });
        window.dispatchEvent(loginEvent);
        
        console.log('🚪 Login event dispatched to socket server');
      } catch (error) {
        console.log('Socket login event failed (socket may not be connected):', error);
      }

      await new Promise(r => setTimeout(r, 120))
      window.location.href = '/dashboard'
      return
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
