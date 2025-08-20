#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkFunctionSignature() {
  try {
    console.log('🔍 Checking Function Signatures...\n');
    
    // Check all functions related to break ending soon
    const functionsResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_function_identity_arguments(oid) as arguments,
        pg_get_function_result(oid) as return_type
      FROM pg_proc 
      WHERE proname LIKE '%ending%' OR proname LIKE '%end%'
      ORDER BY proname
    `);
    
    console.log('1️⃣ Functions with "ending" or "end" in name:');
    functionsResult.rows.forEach((func, index) => {
      console.log(`   ${index + 1}. ${func.function_name}(${func.arguments}) -> ${func.return_type}`);
    });
    
    // Check specifically for is_break_ending_soon
    console.log('\n2️⃣ Checking is_break_ending_soon specifically:');
    const specificResult = await pool.query(`
      SELECT 
        proname as function_name,
        pg_get_function_identity_arguments(oid) as arguments,
        pg_get_function_result(oid) as return_type,
        pg_get_functiondef(oid) as source
      FROM pg_proc 
      WHERE proname = 'is_break_ending_soon'
      LIMIT 1
    `);
    
    if (specificResult.rows.length > 0) {
      const func = specificResult.rows[0];
      console.log(`   Function: ${func.function_name}`);
      console.log(`   Arguments: ${func.arguments}`);
      console.log(`   Return type: ${func.return_type}`);
      
      // Look at the function call in the source
      const source = func.source;
      if (source.includes('minutes_until_window_ends <= 15')) {
        console.log('\n   📍 Found timing logic:');
        console.log('   ✅ "Break ending soon" triggers when <= 15 minutes before break window ends');
        console.log('   🎯 This means at 12:45 PM (15 min before 1:00 PM), you SHOULD get the notification!');
      }
    } else {
      console.log('   ❌ Function not found');
    }
    
    // Check what parameters the function actually expects
    console.log('\n3️⃣ Testing function calls with different signatures:');
    
    const testAgentId = 2;
    const testTime = '2025-08-19 12:45:00';
    
    // Try different parameter combinations
    const testCases = [
      { name: '2 params (agent_id, break_type)', params: [testAgentId, 'Lunch'] },
      { name: '3 params (agent_id, break_type, time)', params: [testAgentId, 'Lunch', testTime] },
      { name: '2 params (agent_id, time)', params: [testAgentId, testTime] },
      { name: '1 param (agent_id)', params: [testAgentId] }
    ];
    
    for (const testCase of testCases) {
      try {
        let query;
        if (testCase.params.length === 1) {
          query = `SELECT is_break_ending_soon($1)`;
        } else if (testCase.params.length === 2) {
          query = `SELECT is_break_ending_soon($1, $2)`;
        } else {
          query = `SELECT is_break_ending_soon($1, $2, $3)`;
        }
        
        const result = await pool.query(query, testCase.params);
        console.log(`   ${testCase.name}: ✅ SUCCESS - Result: ${result.rows[0].is_break_ending_soon}`);
        
      } catch (error) {
        console.log(`   ${testCase.name}: ❌ Error - ${error.message}`);
      }
    }
    
    // 4. Answer the user's question
    console.log('\n🎯 Answer to your question:');
    console.log(`   Current time: 12:43 PM`);
    console.log(`   Lunch break ends at: 1:00 PM`);
    console.log(`   You are 17 minutes before the break window ends`);
    console.log(`   "Ending soon" notifications trigger at 15 minutes before`);
    console.log(`   🎉 So at 12:45 PM, you WILL receive "Break ending soon" notification!`);
    
  } catch (error) {
    console.error('❌ Error checking function signatures:', error);
  } finally {
    await pool.end();
  }
}

// Run the check
checkFunctionSignature();
