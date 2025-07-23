'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import { AppHeader } from '@/components/app-header'
import {
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'

interface DatabaseStatus {
  success: boolean
  message: string
  status?: {
    isConnected: boolean
    poolSize: number
    idleCount: number
    waitingCount: number
  }
  timestamp?: string
  error?: string
}

export default function DatabaseTestPage() {
  const [status, setStatus] = useState<DatabaseStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const testDatabaseConnection = async () => {
    setIsLoading(true)
    setStatus(null)

    try {
      const response = await fetch('/api/database/test')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      setStatus({
        success: false,
        message: 'Failed to test database connection',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="container mx-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Database Connection Test</h1>
              <p className="text-muted-foreground">
                Test the database connection and view connection status
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Database Connection
                </CardTitle>
                <CardDescription>
                  Click the button below to test the database connection
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={testDatabaseConnection} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <Database className="mr-2 h-4 w-4" />
                      Test Database Connection
                    </>
                  )}
                </Button>

                {status && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {status.success ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <Badge variant={status.success ? "default" : "destructive"}>
                        {status.success ? "Connected" : "Failed"}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm">
                        <strong>Message:</strong> {status.message}
                      </p>
                      
                      {status.error && (
                        <p className="text-sm text-red-600">
                          <strong>Error:</strong> {status.error}
                        </p>
                      )}

                      {status.timestamp && (
                        <p className="text-sm text-muted-foreground">
                          <strong>Timestamp:</strong> {status.timestamp}
                        </p>
                      )}

                      {status.status && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Connection Pool Status:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <strong>Connected:</strong> {status.status.isConnected ? "Yes" : "No"}
                            </div>
                            <div>
                              <strong>Pool Size:</strong> {status.status.poolSize}
                            </div>
                            <div>
                              <strong>Idle Connections:</strong> {status.status.idleCount}
                            </div>
                            <div>
                              <strong>Waiting:</strong> {status.status.waitingCount}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Environment Variables</CardTitle>
                <CardDescription>
                  Check if required environment variables are set
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <strong>DATABASE_URL:</strong>
                    <Badge variant="secondary">Server-side only</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>NODE_ENV:</strong>
                    <Badge variant="default">{process.env.NEXT_PUBLIC_NODE_ENV || 'development'}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <strong>ENABLE_DATABASE_LOGGING:</strong>
                    <Badge variant="default">Server-side only</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 