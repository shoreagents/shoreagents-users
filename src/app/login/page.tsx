import { LoginForm } from "@/components/login-form"
import { WindowControls } from "@/components/window-controls"
import Image from "next/image"

export default function LoginPage() {
  return (
    <div className="bg-gradient-to-br from-green-50 to-green-100 flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 relative">
      {/* Logo - Fixed to top left */}
      <div className="absolute top-4 left-4 z-50">
        <Image 
          src="/shoreagents-logo.png" 
          alt="ShoreAgents Logo" 
          width={200}
          height={64}
          className="h-16 w-auto"
          priority
        />
      </div>
      
      {/* Window Controls - Fixed to top right */}
      <div className="absolute top-4 right-4 z-50">
        <WindowControls />
      </div>
      
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
