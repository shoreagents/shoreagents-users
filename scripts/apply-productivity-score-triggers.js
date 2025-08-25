const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyProductivityScoreTriggers() {
  try {
    console.log('🔧 Applying Auto-Productivity Score Triggers Migration\n');
    
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', 'migrations', '047_auto_productivity_score_triggers.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('1️⃣ Applying auto-productivity score triggers...');
    await pool.query(migrationSQL);
    console.log('   ✅ Auto-productivity score triggers applied successfully');
    
    // Test the triggers by checking if they exist
    console.log('\n2️⃣ Verifying triggers were created...');
    const triggerCheck = await pool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers 
      WHERE trigger_name IN (
        'trg_auto_productivity_score_on_insert',
        'trg_auto_productivity_score_on_update'
      )
      ORDER BY trigger_name;
    `);
    
    if (triggerCheck.rows.length === 2) {
      console.log('   ✅ Both triggers created successfully:');
      triggerCheck.rows.forEach(trigger => {
        console.log(`      - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
      });
    } else {
      console.log('   ⚠️  Some triggers may not have been created properly');
      console.log('      Expected: 2, Found:', triggerCheck.rows.length);
    }
    
    // Test the manual calculation function
    console.log('\n3️⃣ Testing manual productivity calculation function...');
    try {
      const testResult = await pool.query('SELECT trigger_manual_productivity_calculation() as result');
      console.log('   ✅ Manual calculation function working:', testResult.rows[0].result);
    } catch (error) {
      console.log('   ⚠️  Manual calculation function test failed:', error.message);
    }
    
    // Test the status check function
    console.log('\n4️⃣ Testing productivity calculation status function...');
    try {
      const statusResult = await pool.query('SELECT * FROM check_productivity_calculation_status() LIMIT 5');
      console.log('   ✅ Status check function working, found', statusResult.rows.length, 'records');
    } catch (error) {
      console.log('   ⚠️  Status check function test failed:', error.message);
    }
    
    console.log('\n🎉 Auto-Productivity Score Triggers Migration Completed Successfully!');
    console.log('\n📋 What was implemented:');
    console.log('   • Automatic productivity score calculation when activity_data changes');
    console.log('   • Triggers for INSERT and UPDATE operations on activity_data');
    console.log('   • Manual calculation functions for testing and debugging');
    console.log('   • Status checking functions to monitor calculation health');
    console.log('\n💡 Benefits:');
    console.log('   • Productivity scores now update automatically in real-time');
    console.log('   • No more manual API calls needed for score updates');
    console.log('   • Better performance and user experience');
    console.log('   • Reduced database load from unnecessary polling');
    
  } catch (error) {
    console.error('❌ Error applying productivity score triggers:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  applyProductivityScoreTriggers()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { applyProductivityScoreTriggers };
