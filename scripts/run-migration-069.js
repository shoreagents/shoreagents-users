#!/usr/bin/env node

/**
 * Run Migration 069: Fix meeting functions to include started_automatically column
 * This migration updates the meeting-related functions to work with the new started_automatically column
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting Migration 069: Fix meeting functions...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '069_fix_meeting_functions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 069 completed successfully!');
    console.log('📋 Changes made:');
    console.log('   • Updated get_active_meeting function to include started_automatically column');
    console.log('   • Updated get_meeting_statistics function for consistency');
    console.log('   • Fixed function return types to match table structure');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    
    // Test the functions
    try {
      const activeResult = await client.query('SELECT * FROM get_active_meeting(2)');
      console.log('✅ get_active_meeting function works correctly');
    } catch (error) {
      console.log('❌ get_active_meeting function error:', error.message);
    }
    
    try {
      const statsResult = await client.query('SELECT * FROM get_meeting_statistics(2, 7)');
      console.log('✅ get_meeting_statistics function works correctly');
    } catch (error) {
      console.log('❌ get_meeting_statistics function error:', error.message);
    }
    
    try {
      const inMeetingResult = await client.query('SELECT is_user_in_meeting(2)');
      console.log('✅ is_user_in_meeting function works correctly');
    } catch (error) {
      console.log('❌ is_user_in_meeting function error:', error.message);
    }
    
    console.log('\n🎉 Migration 069 verification completed!');
    
  } catch (error) {
    console.error('❌ Migration 069 failed:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n✅ Migration 069 completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration 069 failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
