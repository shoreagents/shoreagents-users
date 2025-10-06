import { LoginForm } from "@/components/login-form"
import { WindowControls } from "@/components/window-controls"
import Image from "next/image"

export default function LoginPage() {
  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 relative">
      {/* Draggable Top Bar with Logo and Window Controls */}
      <div 
        className="absolute top-0 left-0 right-0 h-20 z-50 flex items-center justify-between px-4"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Logo - Left side */}
        <div className="flex items-center">
          <Image 
            src="/shoreagents-logo.png" 
            alt="ShoreAgents Logo" 
            width={200}
            height={64}
            className="h-16 w-auto"
            priority
          />
        </div>
        
        {/* Window Controls - Right side */}
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <WindowControls />
        </div>
      </div>
      
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
