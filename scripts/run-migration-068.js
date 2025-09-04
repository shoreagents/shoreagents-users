#!/usr/bin/env node

/**
 * Run Migration 068: Fix meeting start notifications
 * This migration modifies the notification system to only send notifications for scheduled meetings that start automatically
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
    console.log('🚀 Starting Migration 068: Fix meeting start notifications...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '068_fix_meeting_start_notifications.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 068 completed successfully!');
    console.log('📋 Changes made:');
    console.log('   • Added started_automatically column to meetings table');
    console.log('   • Updated start_meeting function to accept automatic flag');
    console.log('   • Modified notification function to only send notifications for automatically started meetings');
    console.log('   • Updated scheduler to mark meetings as automatically started');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    
    // Check if the new column exists
    const columnCheck = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'meetings' AND column_name = 'started_automatically'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('✅ started_automatically column added successfully');
    } else {
      console.log('❌ started_automatically column not found');
    }
    
    // Check function signatures
    const functionCheck = await client.query(`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'start_meeting' AND routine_type = 'FUNCTION'
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log('✅ start_meeting function updated successfully');
    } else {
      console.log('❌ start_meeting function not found');
    }
    
    console.log('\n🎉 Migration 068 verification completed!');
    
  } catch (error) {
    console.error('❌ Migration 068 failed:', error.message);
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
      console.log('\n✅ Migration 068 completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration 068 failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runMigration };
