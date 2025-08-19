#!/usr/bin/env node

/**
 * Debug Database Query
 * 
 * This script tests the exact database query that the socket server uses
 * to get shift information for break notifications.
 */

require('dotenv').config({ path: '.env.local' });

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function debugDatabaseQuery() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Debugging Database Query for Shift Information...\n');
    
    const userId = 2; // kyle.p@shoreagents.com
    const email = 'kyle.p@shoreagents.com';
    
    console.log(`Testing for user ID: ${userId}, Email: ${email}\n`);
    
    // Test the exact query from socket server
    const shiftQuery = `
      SELECT 
        ji.shift_time,
        ji.shift_period,
        ji.shift_schedule,
        ji.agent_user_id
      FROM job_info ji
      WHERE ji.agent_user_id = $1
      LIMIT 1
    `;
    
    console.log('📋 Testing shift query with user ID:');
    console.log(shiftQuery);
    console.log(`Parameters: [${userId}]\n`);
    
    const shiftResult = await client.query(shiftQuery, [userId]);
    console.log(`Shift query result: ${shiftResult.rows.length} rows`);
    
    if (shiftResult.rows.length > 0) {
      console.log('✅ Shift data found:');
      console.log(JSON.stringify(shiftResult.rows[0], null, 2));
    } else {
      console.log('❌ No shift data found with user ID');
    }
    
    // Test with email instead
    const emailQuery = `
      SELECT 
        ji.shift_time,
        ji.shift_period,
        ji.shift_schedule,
        ji.agent_user_id,
        u.email
      FROM job_info ji
      JOIN users u ON ji.agent_user_id = u.id
      WHERE u.email = $1
      LIMIT 1
    `;
    
    console.log('\n📋 Testing shift query with email:');
    console.log(emailQuery);
    console.log(`Parameters: ['${email}']\n`);
    
    const emailResult = await client.query(emailQuery, [email]);
    console.log(`Email query result: ${emailResult.rows.length} rows`);
    
    if (emailResult.rows.length > 0) {
      console.log('✅ Shift data found with email:');
      console.log(JSON.stringify(emailResult.rows[0], null, 2));
    } else {
      console.log('❌ No shift data found with email');
    }
    
    // Check if there are any issues with the job_info table
    console.log('\n🔍 Checking job_info table structure...');
    const tableStructureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'job_info'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await client.query(tableStructureQuery);
    console.log('job_info table structure:');
    structureResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check all records in job_info
    console.log('\n🔍 Checking all job_info records...');
    const allRecordsQuery = `
      SELECT ji.*, u.email
      FROM job_info ji
      LEFT JOIN users u ON ji.agent_user_id = u.id
      ORDER BY ji.agent_user_id
    `;
    
    const allRecordsResult = await client.query(allRecordsQuery);
    console.log(`Total job_info records: ${allRecordsResult.rows.length}`);
    
    allRecordsResult.rows.forEach((record, index) => {
      console.log(`\n${index + 1}. Agent User ID: ${record.agent_user_id}`);
      console.log(`   Email: ${record.email || 'NULL'}`);
      console.log(`   Shift Time: ${record.shift_time || 'NULL'}`);
      console.log(`   Shift Period: ${record.shift_period || 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  debugDatabaseQuery().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { debugDatabaseQuery };
