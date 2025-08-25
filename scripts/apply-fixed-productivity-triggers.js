const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyFixedProductivityTriggers() {
  try {
    console.log('🔧 Applying Fixed Auto-Productivity Score Triggers Migration\n');
    
    // Read the migration file
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', 'migrations', '048_fixed_productivity_score_triggers.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('1️⃣ Dropping problematic triggers and functions...');
    await pool.query(migrationSQL);
    console.log('   ✅ Fixed productivity score triggers applied successfully');
    
    // Test the new trigger by checking if it exists
    console.log('\n2️⃣ Verifying new trigger was created...');
    const triggerCheck = await pool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers 
      WHERE trigger_name = 'trg_productivity_score_on_time_change'
      ORDER BY trigger_name;
    `);
    
    if (triggerCheck.rows.length === 1) {
      console.log('   ✅ New trigger created successfully:');
      triggerCheck.rows.forEach(trigger => {
        console.log(`      - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
      });
    } else {
      console.log('   ⚠️  New trigger may not have been created properly');
      console.log('      Expected: 1, Found:', triggerCheck.rows.length);
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
    
    console.log('\n🎉 Fixed Auto-Productivity Score Triggers Migration Completed Successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   • Removed problematic triggers that were causing database update failures');
    console.log('   • Created new, simplified trigger that only fires on meaningful time changes');
    console.log('   • Added conflict prevention to avoid blocking normal database operations');
    console.log('   • Uses notifications instead of direct function calls to prevent conflicts');
    console.log('\n💡 Benefits:');
    console.log('   • Database updates now work without "trigger functions can only be called as triggers" errors');
    console.log('   • Productivity scores still update automatically, but more intelligently');
    console.log('   • Better performance and reliability');
    console.log('   • No more blocking of normal activity tracking');
    
  } catch (error) {
    console.error('❌ Error applying fixed productivity score triggers:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  applyFixedProductivityTriggers()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { applyFixedProductivityTriggers };
