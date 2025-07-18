import { useState, useCallback } from 'react'

interface ToastOptions {
  title: string
  description?: string
  duration?: number
  variant?: 'default' | 'destructive' | 'success'
}

interface Toast extends ToastOptions {
  id: string
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: Toast = {
      id,
      duration: 5000,
      variant: 'default',
      ...options,
    }

    setToasts(prev => [...prev, newToast])

    // Auto remove toast after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, newToast.duration)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return {
    toast,
    dismiss,
    toasts,
  }
} 