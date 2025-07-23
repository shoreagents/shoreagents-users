#!/usr/bin/env node

/**
 * Database Connection Check Script
 * Run this to verify your database setup
 */

console.log('🔍 Checking database connection setup...\n');

// Check environment variables
const envVars = {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  ENABLE_DATABASE_LOGGING: process.env.ENABLE_DATABASE_LOGGING,
};

console.log('📊 Environment Variables:');
Object.entries(envVars).forEach(([key, value]) => {
  const status = value ? '✅ Set' : '❌ Not Set';
  const displayValue = value ? 
    (key === 'DATABASE_URL' ? 
      value.substring(0, 20) + '...' : 
      value
    ) : 
    'undefined';
  
  console.log(`  ${key}: ${status} (${displayValue})`);
});

console.log('\n🔗 Database URL Analysis:');
if (envVars.DATABASE_URL) {
  const url = envVars.DATABASE_URL;
  
  // Check URL format
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    console.log('  ✅ Valid PostgreSQL URL format');
  } else {
    console.log('  ❌ Invalid URL format (should start with postgresql:// or postgres://)');
  }
  
  // Check for common issues
  if (url.includes('railway.internal')) {
    console.log('  ⚠️  Using Railway internal URL (this should work in Railway deployment)');
  }
  
  if (url.includes('localhost')) {
    console.log('  ⚠️  Using localhost (make sure database is running locally)');
  }
  
  // Extract host for debugging
  try {
    const hostMatch = url.match(/@([^:]+):/);
    if (hostMatch) {
      console.log(`  📍 Host: ${hostMatch[1]}`);
    }
  } catch (error) {
    console.log('  ❌ Could not parse host from URL');
  }
} else {
  console.log('  ❌ DATABASE_URL not set');
}

console.log('\n🚀 Next Steps:');
console.log('1. If DATABASE_URL is not set:');
console.log('   - Add PostgreSQL service in Railway');
console.log('   - Or set DATABASE_URL in your .env.local file');
console.log('');
console.log('2. If DATABASE_URL is set but connection fails:');
console.log('   - Check if database service is running');
console.log('   - Verify the connection string format');
console.log('   - Ensure network connectivity');
console.log('');
console.log('3. For Railway deployment:');
console.log('   - DATABASE_URL is automatically provided');
console.log('   - Make sure PostgreSQL service is added to your project');
console.log('');
console.log('4. Test the connection:');
console.log('   - Visit /database-test in your app');
console.log('   - Or call /api/database/test endpoint');

console.log('\n📝 For more help, check the console logs when running the app.'); 