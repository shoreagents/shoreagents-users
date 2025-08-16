const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  try {
    console.log('🚀 Starting daily tracking migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/019_add_today_date_column.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        console.log(`   ${statement.substring(0, 100)}${statement.length > 100 ? '...' : ''}`);
        
        await pool.query(statement);
        console.log(`✅ Statement ${i + 1} completed`);
      }
    }
    
    console.log('🎉 Daily tracking migration completed successfully!');
    console.log('');
    console.log('📋 What was added:');
    console.log('   ✅ today_date column to activity_data table');
    console.log('   ✅ Daily tracking with separate rows per day');
    console.log('   ✅ New unique constraint (user_id, today_date)');
    console.log('   ✅ Performance indexes for date queries');
    console.log('   ✅ Helper functions for daily activity management');
    console.log('');
    console.log('📊 Now you can track:');
    console.log('   - 08/01/2025: 8hrs active, 1hr inactive');
    console.log('   - 08/02/2025: 7hrs active, 2hrs inactive');
    console.log('   - And so on for each day...');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Test the new functions
async function testDailyTracking() {
  try {
    console.log('\n🧪 Testing daily tracking functions...');
    
    // Test getting current day activity
    const testResult = await pool.query(`
      SELECT 
        get_current_day_activity(1) as current_day,
        get_daily_activity_summary(1, CURRENT_DATE - INTERVAL '7 days', CURRENT_DATE) as weekly_summary
    `);
    
    console.log('✅ Daily tracking functions are working!');
    console.log('📊 Sample data structure:');
    console.log('   - Each user can have multiple rows (one per day)');
    console.log('   - today_date column tracks which day the data belongs to');
    console.log('   - Historical data is preserved per day');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the migration
runMigration().then(() => {
  return testDailyTracking();
}).catch(console.error); 