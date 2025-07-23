'use client'

import { useEffect, useState } from 'react'

export default function DatabaseInitializer() {
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initDatabase = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Only initialize in production or when DATABASE_URL is set
        if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
          console.log('🚀 Initializing database connection...')
          
          // Call the API to initialize database instead of direct import
          const response = await fetch('/api/database/test')
          const data = await response.json()
          
          if (data.success) {
            setIsInitialized(true)
            console.log('✅ Database initialization completed successfully!')
            console.log('📊 Database status:', data.status)
          } else {
            throw new Error(data.error || 'Database connection test failed')
          }
        } else {
          console.log('⚠️ Skipping database initialization - DATABASE_URL not set')
          setIsInitialized(true)
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown database error'
        setError(errorMessage)
        console.error('❌ Database initialization failed:', errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    initDatabase()
  }, [])

  // This component doesn't render anything visible
  // It just handles database initialization
  return null
} 