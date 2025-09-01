"use client"

import { useLogout } from "@/contexts/logout-context"
import { Loader2, LogOut } from "lucide-react"

export function LogoutLoadingOverlay() {
  const { isLoggingOut } = useLogout()

  if (!isLoggingOut) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6 max-w-sm mx-4 transform transition-all duration-300 ease-out animate-in zoom-in-95 duration-300">
        <div className="relative">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <LogOut className="h-10 w-10 text-blue-600 dark:text-blue-400" />
          </div>
          
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Logging out...</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-xs">
            Please wait while we securely log you out and clean up your session
          </p>
        </div>
        <div className="flex space-x-2">
          <div className="h-2 w-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="h-2 w-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="h-2 w-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  )
}
