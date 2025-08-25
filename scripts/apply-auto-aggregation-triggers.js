#!/usr/bin/env node

/**
 * Script to apply auto-aggregation triggers migration
 * This eliminates the need for 15-second frontend polling of weekly/monthly data
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyAutoAggregationTriggers() {
  console.log('🚀 Applying Auto-Aggregation Triggers Migration\n');
  
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '046_auto_aggregation_triggers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration file loaded successfully');
    
    // Apply the migration
    console.log('🔧 Applying auto-aggregation triggers...');
    await pool.query(migrationSQL);
    
    console.log('✅ Auto-aggregation triggers applied successfully!');
    
    // Test the new functions
    console.log('\n🧪 Testing new functions...');
    
    // Test the manual aggregation function
    const testResult = await pool.query('SELECT trigger_manual_aggregation() as result');
    console.log('✅ Manual aggregation function working:', testResult.rows[0].result);
    
    // Test the aggregation status function
    const statusResult = await pool.query('SELECT check_aggregation_status() LIMIT 1');
    console.log('✅ Aggregation status function working:', statusResult.rows.length > 0 ? 'Data returned' : 'No recent data');
    
    // Check if triggers were created
    const triggersResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE trigger_name LIKE '%auto_aggregate%'
      ORDER BY trigger_name
    `);
    
    console.log('\n🔍 Auto-aggregation triggers created:');
    triggersResult.rows.forEach(trigger => {
      console.log(`   • ${trigger.trigger_name} (${trigger.event_manipulation})`);
    });
    
    // Check the functions
    const functionsResult = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines 
      WHERE routine_name LIKE '%auto_aggregate%' 
      OR routine_name LIKE '%trigger_manual%'
      OR routine_name LIKE '%check_aggregation%'
      ORDER BY routine_name
    `);
    
    console.log('\n🔍 Auto-aggregation functions created:');
    functionsResult.rows.forEach(func => {
      console.log(`   • ${func.routine_name} (${func.routine_type})`);
    });
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 What this migration does:');
    console.log('   • Creates triggers that automatically update weekly/monthly summaries');
    console.log('   • Eliminates the need for 15-second frontend polling');
    console.log('   • Ensures data is always up-to-date in real-time');
    console.log('   • Provides manual aggregation functions for testing/debugging');
    console.log('   • Includes aggregation status checking functions');
    
    console.log('\n🔄 Next steps:');
    console.log('   1. Remove 15-second intervals from frontend components');
    console.log('   2. Update API endpoints to remove manual aggregation calls');
    console.log('   3. Test that data updates automatically when activity changes');
    
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  applyAutoAggregationTriggers();
}

module.exports = { applyAutoAggregationTriggers };
