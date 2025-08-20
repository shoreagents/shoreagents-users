#!/usr/bin/env node

/**
 * Check Users in Database
 * 
 * This script lists all users in the database to find the correct email.
 */

require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUsers() {
  const client = await pool.connect();
  
  try {
    console.log('👥 Checking Users in Database...\n');
    
    // First check the structure of the users table
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await client.query(tableStructureQuery);
    console.log('📋 Users table structure:');
    structureResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    console.log('');
    
    // Get all users with available columns
    const usersQuery = `
      SELECT id, email, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 20
    `;
    
    const usersResult = await client.query(usersQuery);
    console.log(`Found ${usersResult.rows.length} users:\n`);
    
    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   ID: ${user.id}, Created: ${user.created_at}`);
      console.log('');
    });
    
    // Check if any users have job_info
    const jobInfoQuery = `
      SELECT u.email, ji.shift_time, ji.shift_period
      FROM users u
      JOIN job_info ji ON u.id = ji.agent_user_id
      WHERE ji.shift_time IS NOT NULL
      ORDER BY u.created_at DESC
      LIMIT 10
    `;
    
    const jobInfoResult = await client.query(jobInfoQuery);
    console.log(`\n👔 Users with Job Info: ${jobInfoResult.rows.length}\n`);
    
    jobInfoResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Shift: ${user.shift_time}, Period: ${user.shift_period}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the check
if (require.main === module) {
  checkUsers().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { checkUsers }; 