import { WindowControls } from "@/components/window-controls"

export default function HomePage() {
  // This page should never be seen because middleware will redirect
  // Either to /login (if not authenticated) or /dashboard (if authenticated)
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center relative">
      {/* Window Controls - Fixed to top right */}
      <div className="absolute top-4 right-4 z-50">
        <WindowControls />
      </div>
      
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
