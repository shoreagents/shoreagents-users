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

  // Dummy credentials for ShoreAgents
  const validCredentials = [
    {
      email: "agent@shoreagents.com",
      password: "shoreagents123",
      name: "Agent User",
      role: "agent"
    },
    {
      email: "agent0@shoreagents.com",
      password: "shoreagents123",
      name: "Agent 0",
      role: "agent"
    }
  ]

  const setCookie = (name: string, value: string, days: number) => {
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const user = validCredentials.find(cred => cred.email === email && cred.password === password)
    
    if (user) {
      // Store authentication state in both cookie and localStorage
      const authData = {
        isAuthenticated: true,
        user: {
          email: user.email,
          name: user.name,
          role: user.role
        },
        timestamp: new Date().toISOString()
      }

      // Set cookie for middleware
      setCookie("shoreagents-auth", JSON.stringify(authData), 7)
      
      // Also store in localStorage for client-side access
      localStorage.setItem("shoreagents-auth", JSON.stringify(authData))

      // Start activity tracking for the logged-in user
      setUserLoggedIn()

      // Redirect to dashboard
      router.push("/dashboard")
    } else {
      setError("Invalid email or password. Please try again.")
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
            <p className="mb-2">Demo Credentials:</p>
            <div className="space-y-1">
              <div>
                <p className="text-xs">
                  User 1: <code className="bg-muted px-1 rounded">agent@shoreagents.com</code>
                </p>
                <p className="text-xs">
                  User 2: <code className="bg-muted px-1 rounded">agent0@shoreagents.com</code>
                </p>
                <p className="text-xs">
                  Password: <code className="bg-muted px-1 rounded">shoreagents123</code>
                </p>
              </div>
          </div>
        </div>
      </form>
      </CardContent>
    </Card>
  )
}
