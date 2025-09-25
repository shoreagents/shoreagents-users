import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Get build time from environment variable or current timestamp
    const buildTime = process.env.BUILD_TIME || new Date().toISOString()
    
    // Get app version from package.json
    const packageJson = require('../../../../package.json')
    const version = packageJson.version || '0.1.0'
    
    // Get git commit hash for better change detection
    let gitCommitHash = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'unknown'
    
    // Create a unique build identifier
    const buildId = `${version}-${gitCommitHash.substring(0, 8)}-${buildTime}`
    
    return NextResponse.json({
      buildTime,
      version,
      buildId,
      gitCommitHash,
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error getting build info:', error)
    return NextResponse.json({
      buildTime: new Date().toISOString(),
      version: '0.1.0',
      buildId: `0.1.0-unknown-${new Date().toISOString()}`,
      gitCommitHash: 'unknown',
      timestamp: Date.now()
    })
  }
}
