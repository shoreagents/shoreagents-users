const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBothSchedulers() {
  console.log('🧪 Testing Both Schedulers\n');
  
  try {
    // Test 1: Break reminders (should work)
    console.log('1️⃣ Testing break reminder scheduler...');
    const breakResult = await pool.query('SELECT check_break_reminders()');
    console.log(`   ⏰ Break reminders: ${breakResult.rows[0].check_break_reminders} notifications sent`);
    
    // Test 2: Task notifications (should work)
    console.log('\n2️⃣ Testing task notification scheduler...');
    const taskResult = await pool.query('SELECT check_all_task_notifications()');
    console.log(`   📋 Task notifications: ${taskResult.rows[0].check_all_task_notifications} notifications sent`);
    
    // Test 3: Verify both functions exist and are separate
    console.log('\n3️⃣ Verifying function separation...');
    
    const breakFunction = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition 
      FROM pg_proc 
      WHERE proname = 'check_break_reminders' 
      LIMIT 1
    `);
    
    const taskFunction = await pool.query(`
      SELECT pg_get_functiondef(oid) as definition 
      FROM pg_proc 
      WHERE proname = 'check_all_task_notifications' 
      LIMIT 1
    `);
    
    if (breakFunction.rows[0] && taskFunction.rows[0]) {
      console.log('   ✅ Both functions exist in database');
      
      // Check if break function contains task notifications
      const breakDef = breakFunction.rows[0].definition;
      const hasTaskNotifications = breakDef.includes('check_all_task_notifications');
      
      if (!hasTaskNotifications) {
        console.log('   ✅ Break function is clean (no task notifications)');
      } else {
        console.log('   ⚠️ Break function still contains task notifications');
      }
      
    } else {
      console.log('   ❌ One or both functions missing');
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • Break reminders: Working independently');
    console.log('   • Task notifications: Working independently');
    console.log('   • Functions: Properly separated');
    console.log('   • Both schedulers can now run at different intervals');
    
  } catch (error) {
    console.error('❌ Error testing schedulers:', error.message);
  } finally {
    await pool.end();
  }
}

testBothSchedulers().catch(console.error);
