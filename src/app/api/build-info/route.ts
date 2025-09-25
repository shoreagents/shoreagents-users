import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get build time from environment variable or current timestamp
    const buildTime = process.env.BUILD_TIME || new Date().toISOString()
    
    // Get app version from package.json
    const packageJson = require('../../../../package.json')
    const version = packageJson.version || '0.1.0'
    
    return NextResponse.json({
      buildTime,
      version,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error getting build info:', error)
    return NextResponse.json({
      buildTime: new Date().toISOString(),
      version: '0.1.0',
      timestamp: Date.now()
    })
  }
}
