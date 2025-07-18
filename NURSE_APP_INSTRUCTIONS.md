# Nurse App - Health Check Request Integration

## 📋 **Overview**
This document provides step-by-step instructions to integrate health check request receiving and approval functionality into your existing nurse Electron app.

## 🎯 **What the Feature Should Do**

### **Core Functionality:**
1. **Listen for health check requests** from agent computers on the network
2. **Display incoming requests** in real-time with agent information
3. **Allow nurse to approve/deny** requests with one click
4. **Send response back to agent** automatically
5. **Show request history** for the current shift
6. **Display network connection status**

### **User Experience:**
- Nurse sees a **notification popup** when new request arrives
- **Audio alert** (optional) for urgent requests
- **Request queue** shows all pending requests
- **One-click approve/deny** buttons
- **Request disappears** after processing
- **Status indicators** show if system is working

---

## 🔧 **Implementation Steps**

### **Step 1: Install Dependencies**

Add these to your existing `package.json`:

```json
{
  "dependencies": {
    // ... your existing dependencies
  },
  "devDependencies": {
    "@types/dgram": "^1.3.6"
    // ... your existing dev dependencies
  }
}
```

Then run:
```bash
npm install
```

### **Step 2: Create Network Service File**

Create a new file: `src/lib/health-network.ts`

```typescript
import * as dgram from 'dgram'
import * as os from 'os'

export interface HealthRequest {
  type: 'health-request'
  agentId: string
  agentName: string
  agentDepartment?: string
  timestamp: number
  agentIP: string
  message: string
}

export interface HealthResponse {
  type: 'health-approved' | 'health-denied'
  requestId: string
  message: string
  approvedBy: string
  timestamp: number
  nurseIP: string
}

export interface NetworkServiceCallbacks {
  onHealthRequest?: (request: HealthRequest, senderInfo: dgram.RemoteInfo) => void
  onError?: (error: Error) => void
}

export class HealthNetworkService {
  private socket: dgram.Socket
  private callbacks: NetworkServiceCallbacks
  private isListening: boolean = false

  constructor(callbacks: NetworkServiceCallbacks = {}) {
    this.callbacks = callbacks
    this.socket = dgram.createSocket('udp4')
    this.setupSocket()
  }

  private setupSocket() {
    this.socket.on('error', (err) => {
      console.error('Network socket error:', err)
      this.callbacks.onError?.(err)
    })

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString())
        console.log(`📨 Received message from ${rinfo.address}:${rinfo.port}`, data)
        
        if (data.type === 'health-request') {
          this.callbacks.onHealthRequest?.(data as HealthRequest, rinfo)
        }
      } catch (error) {
        console.error('Error parsing message:', error)
      }
    })

    this.socket.on('listening', () => {
      const address = this.socket.address()
      console.log(`🎧 Nurse UDP Server listening on port ${address.port}`)
      this.isListening = true
    })
  }

  public startListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isListening) {
        resolve()
        return
      }

      this.socket.bind(8080, (error) => { // Nurse listens on port 8080
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  public approveHealthRequest(agentIP: string, requestId: string, nurseId: string = 'Nurse Ron'): void {
    const response: HealthResponse = {
      type: 'health-approved',
      requestId,
      message: 'You may now go to the clinic at Unit 2 left side of black room',
      approvedBy: nurseId,
      timestamp: Date.now(),
      nurseIP: this.getLocalIP()
    }

    const messageString = JSON.stringify(response)
    
    this.socket.send(messageString, 8081, agentIP, (error) => {
      if (error) {
        console.error('Error sending approval:', error)
        this.callbacks.onError?.(error)
      } else {
        console.log(`✅ Health check approved for agent at ${agentIP}`)
      }
    })
  }

  public denyHealthRequest(agentIP: string, requestId: string, reason: string, nurseId: string = 'Nurse Ron'): void {
    const response: HealthResponse = {
      type: 'health-denied',
      requestId,
      message: `Health check request denied. Reason: ${reason}`,
      approvedBy: nurseId,
      timestamp: Date.now(),
      nurseIP: this.getLocalIP()
    }

    const messageString = JSON.stringify(response)
    
    this.socket.send(messageString, 8081, agentIP, (error) => {
      if (error) {
        console.error('Error sending denial:', error)
        this.callbacks.onError?.(error)
      } else {
        console.log(`❌ Health check denied for agent at ${agentIP}`)
      }
    })
  }

  private getLocalIP(): string {
    const interfaces = os.networkInterfaces()
    
    for (const name of Object.keys(interfaces)) {
      const netInterface = interfaces[name]
      if (netInterface) {
        for (const iface of netInterface) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address
          }
        }
      }
    }
    
    return '127.0.0.1'
  }

  public isConnected(): boolean {
    return this.isListening
  }

  public destroy(): void {
    if (this.socket) {
      this.socket.close()
      this.isListening = false
      console.log('🔌 Network service disconnected')
    }
  }
}
```

### **Step 3: Create Health Request Component**

Create a new file: `src/components/HealthRequestQueue.tsx` (or `.jsx` if using JavaScript)

```typescript
"use client" // if using Next.js App Router

import { useState, useEffect } from 'react'
import { HealthNetworkService, type HealthRequest } from '@/lib/health-network'
import * as dgram from 'dgram'

// Define your UI components based on your existing design system
// Replace these with your actual component imports
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bell, CheckCircle, X, Heart, Wifi, WifiOff } from 'lucide-react'

interface PendingRequest extends HealthRequest {
  id: string
  receivedAt: Date
}

export function HealthRequestQueue() {
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [networkConnected, setNetworkConnected] = useState(false)
  const [networkService, setNetworkService] = useState<HealthNetworkService | null>(null)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  // Initialize network service when component mounts
  useEffect(() => {
    console.log('🚀 Initializing Health Request Queue...')
    
    const service = new HealthNetworkService({
      onHealthRequest: (request: HealthRequest, senderInfo: dgram.RemoteInfo) => {
        console.log('📨 New health request received:', request)
        
        const pendingRequest: PendingRequest = {
          ...request,
          id: `pending-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          receivedAt: new Date(),
          agentIP: senderInfo.address // Use actual sender IP
        }
        
        // Add to pending requests
        setPendingRequests(prev => [...prev, pendingRequest])
        
        // Show browser notification (if permission granted)
        showBrowserNotification(request)
        
        // Optional: Play sound alert
        playNotificationSound()
      },
      onError: (error: Error) => {
        console.error('❌ Network error:', error)
        setNetworkConnected(false)
      }
    })

    // Start listening for requests
    service.startListening()
      .then(() => {
        setNetworkConnected(true)
        setNetworkService(service)
        console.log('✅ Nurse network service started successfully')
      })
      .catch((error) => {
        console.error('❌ Failed to start nurse network service:', error)
        setNetworkConnected(false)
      })

    // Request notification permission
    requestNotificationPermission()

    // Cleanup when component unmounts
    return () => {
      console.log('🔌 Cleaning up network service...')
      service.destroy()
    }
  }, [])

  const showBrowserNotification = (request: HealthRequest) => {
    if (Notification.permission === 'granted') {
      const notification = new Notification('🏥 New Health Check Request', {
        body: `${request.agentName} is requesting a health check`,
        icon: '/nurse-icon.png', // Add this icon to your public folder
        tag: request.agentId // Prevents duplicate notifications
      })

      // Close notification after 10 seconds
      setTimeout(() => notification.close(), 10000)
    }
  }

  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('Notification permission:', permission)
      })
    }
  }

  const playNotificationSound = () => {
    // Optional: Play a sound when request arrives
    try {
      const audio = new Audio('/notification-sound.mp3') // Add this file to public folder
      audio.play().catch(e => console.log('Could not play notification sound'))
    } catch (error) {
      console.log('Notification sound not available')
    }
  }

  const handleApproveRequest = async (request: PendingRequest) => {
    if (!networkService) {
      console.error('Network service not available')
      return
    }

    setProcessingRequest(request.id)

    try {
      // Send approval to agent
      networkService.approveHealthRequest(request.agentIP, request.id, 'Nurse Ron')
      
      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.id !== request.id))
      
      console.log(`✅ Approved health check for ${request.agentName}`)
      
      // Optional: Log to your existing system
      logHealthCheckAction('approved', request)
      
    } catch (error) {
      console.error('Error approving request:', error)
    } finally {
      setProcessingRequest(null)
    }
  }

  const handleDenyRequest = async (request: PendingRequest) => {
    if (!networkService) {
      console.error('Network service not available')
      return
    }

    setProcessingRequest(request.id)

    try {
      // Send denial to agent
      networkService.denyHealthRequest(request.agentIP, request.id, 'Not available at this time', 'Nurse Ron')
      
      // Remove from pending requests
      setPendingRequests(prev => prev.filter(r => r.id !== request.id))
      
      console.log(`❌ Denied health check for ${request.agentName}`)
      
      // Optional: Log to your existing system
      logHealthCheckAction('denied', request)
      
    } catch (error) {
      console.error('Error denying request:', error)
    } finally {
      setProcessingRequest(null)
    }
  }

  const logHealthCheckAction = (action: 'approved' | 'denied', request: PendingRequest) => {
    // Integrate with your existing logging system here
    console.log(`Health Check ${action}:`, {
      agentName: request.agentName,
      agentId: request.agentId,
      timestamp: new Date(),
      action
    })
  }

  return (
    <div className="space-y-4">
      {/* Network Status Indicator */}
      <div className="flex items-center gap-2 mb-4">
        {networkConnected ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-600">Listening for requests</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">Network disconnected</span>
          </>
        )}
      </div>

      {/* Pending Requests Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Health Check Requests
            {pendingRequests.length > 0 && (
              <Badge variant="destructive">{pendingRequests.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h4 className="font-medium text-lg mb-2">No Pending Requests</h4>
              <p className="text-sm text-muted-foreground">
                Waiting for health check requests from agents...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <Card key={request.id} className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar>
                          <AvatarFallback className="bg-blue-500 text-white">
                            {request.agentName.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{request.agentName}</h4>
                          <p className="text-sm text-muted-foreground">
                            {request.agentDepartment || 'Unknown Department'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Requested at {request.receivedAt.toLocaleTimeString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            From: {request.agentIP}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDenyRequest(request)}
                          disabled={processingRequest === request.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(request)}
                          disabled={processingRequest === request.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {processingRequest === request.id ? 'Approving...' : 'Approve'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### **Step 4: Integrate into Your Existing App**

#### **Option A: Add to Existing Dashboard**
If you have a main dashboard component, add the `HealthRequestQueue` component:

```typescript
// In your existing dashboard component
import { HealthRequestQueue } from '@/components/HealthRequestQueue'

export function YourExistingDashboard() {
  return (
    <div className="dashboard-layout">
      {/* Your existing dashboard content */}
      
      {/* Add this section */}
      <section className="health-requests-section">
        <HealthRequestQueue />
      </section>
      
      {/* Rest of your dashboard */}
    </div>
  )
}
```

#### **Option B: Create New Page/Tab**
If you want a dedicated page, add it to your routing:

```typescript
// Create new page: src/pages/health-requests.tsx (or wherever your pages are)
import { HealthRequestQueue } from '@/components/HealthRequestQueue'

export default function HealthRequestsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Health Check Requests</h1>
      <HealthRequestQueue />
    </div>
  )
}
```

### **Step 5: Add Navigation (if creating new page)**

Add a menu item to your existing navigation:

```typescript
// In your navigation component
{
  title: "Health Requests",
  icon: HeartIcon, // or your preferred icon
  href: "/health-requests",
  badge: pendingRequestsCount // optional badge showing count
}
```

### **Step 6: Test the Integration**

#### **Testing Checklist:**

1. **✅ Start your nurse app** - Should see "Listening for requests" status
2. **✅ Start agent app** on different computer
3. **✅ Agent clicks "Request Health Check"**
4. **✅ Nurse app should receive notification**
5. **✅ Click "Approve" in nurse app**
6. **✅ Agent should see success message**

#### **Debugging Steps:**
- Check console logs for network messages
- Verify both apps are on same network
- Check Windows Firewall isn't blocking ports 8080/8081
- Test with `ping` between computers first

---

## 🎨 **UI/UX Recommendations**

### **Visual Indicators:**
- **🟢 Green dot**: Network connected and listening
- **🔴 Red dot**: Network disconnected
- **🟡 Orange badge**: Pending requests count
- **💙 Blue avatar**: Agent initials

### **Notifications:**
- **Browser notification**: When new request arrives
- **Sound alert**: Optional audio notification
- **Visual highlight**: Request cards stand out

### **Response Time:**
- **Auto-refresh**: Request status updates in real-time
- **Quick actions**: One-click approve/deny
- **Feedback**: Clear confirmation when action completed

---

## 🔧 **Troubleshooting**

### **Common Issues:**

1. **"Network service failed to start"**
   - Check if port 8080 is already in use
   - Run: `netstat -an | findstr :8080`
   - Solution: Close other apps using port or change port number

2. **"No requests received"**
   - Verify both computers on same network
   - Check Windows Firewall settings
   - Test with ping first: `ping [other-computer-ip]`

3. **"Permission denied"**
   - Run app as administrator (Windows)
   - Check network adapter settings

### **Testing Commands:**
```bash
# Check if port is available
netstat -an | findstr :8080

# Test network connectivity
ping [ip-address]

# Check firewall status
netsh advfirewall show allprofiles
```

---

## 📝 **Integration Notes**

- **Port Usage**: Nurse app uses port 8080, Agent app uses 8081
- **Network Protocol**: UDP broadcast for discovery, direct UDP for responses
- **Data Format**: JSON messages with TypeScript interfaces
- **Error Handling**: All network errors are logged and displayed to user
- **Cleanup**: Network service automatically closes when app closes

---

## 🚀 **Next Steps After Implementation**

1. **Test thoroughly** with multiple agent computers
2. **Add logging** to your existing system
3. **Configure notifications** based on nurse preferences
4. **Add request history** if needed
5. **Monitor network performance** during busy periods

---

**🎯 Goal**: Nurse receives agent health check requests instantly and can approve/deny with one click, sending automatic responses back to the agent. 