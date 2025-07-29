import { NextResponse } from 'next/server'
import { initializeDatabase, testDatabaseConnection, getDatabaseStatus } from '@/lib/database-server'
import { getCurrentPhilippinesTime } from '@/lib/timezone-utils'

export async function GET() {
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        success: false,
        error: 'DATABASE_URL environment variable is not set',
        message: 'Database connection not configured',
        debug: {
          hasDatabaseUrl: false,
          nodeEnv: process.env.NODE_ENV,
          availableEnvVars: Object.keys(process.env).filter(key => key.includes('DATABASE') || key.includes('PG'))
        }
      }, { status: 500 })
    }

    // Log connection attempt
    console.log('🔍 Testing database connection...');
    console.log('📊 Environment check:', {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      urlFormat: process.env.DATABASE_URL?.substring(0, 20) + '...'
    });

    // Initialize database if not already initialized
    try {
      await initializeDatabase()
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Database initialization failed',
        message: 'Unable to initialize database connection',
        debug: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          nodeEnv: process.env.NODE_ENV,
          urlFormat: process.env.DATABASE_URL?.substring(0, 20) + '...',
          errorType: error instanceof Error ? error.constructor.name : 'Unknown'
        }
      }, { status: 500 })
    }

    // Test the connection
    const isConnected = await testDatabaseConnection()
    
    if (isConnected) {
      const status = getDatabaseStatus()
      
      return NextResponse.json({
        success: true,
        message: 'Database connection successful',
        status: status,
        timestamp: getCurrentPhilippinesTime()
      })
    } else {
      return NextResponse.json({
        success: false,
        error: 'Database connection test failed',
        message: 'Unable to connect to database',
        debug: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          nodeEnv: process.env.NODE_ENV,
          urlFormat: process.env.DATABASE_URL?.substring(0, 20) + '...'
        }
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Database test API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database connection failed',
      debug: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        nodeEnv: process.env.NODE_ENV,
        urlFormat: process.env.DATABASE_URL?.substring(0, 20) + '...',
        errorType: error instanceof Error ? error.constructor.name : 'Unknown'
      }
    }, { status: 500 })
  }
} 