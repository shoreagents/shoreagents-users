const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyGlobalActivityTimer() {
  try {
    console.log('🚀 Applying Global Activity Timer function...');
    
    // Read the SQL file
    const sqlFile = path.join(__dirname, 'global-activity-timer.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    console.log('   📖 SQL file loaded');
    
    // Execute the SQL
    await pool.query(sqlContent);
    
    console.log('   ✅ Function created: check_and_reset_activity_for_shift_starts');
    
    // Test the function
    console.log('   🧪 Testing the function...');
    const { rows } = await pool.query('SELECT check_and_reset_activity_for_shift_starts() AS reset_count');
    const resetCount = rows[0]?.reset_count || 0;
    
    console.log(`   ✅ Function test successful - reset count: ${resetCount}`);
    console.log('   📋 Function will now be called every minute by the enhanced scheduler');
    
  } catch (error) {
    console.error('❌ Error applying Global Activity Timer function:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  applyGlobalActivityTimer()
    .then(() => {
      console.log('✅ Global Activity Timer function applied successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed to apply Global Activity Timer function:', error.message);
      process.exit(1);
    });
}

module.exports = { applyGlobalActivityTimer };
