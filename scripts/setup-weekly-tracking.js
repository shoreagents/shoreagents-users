const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupWeeklyTracking() {
  try {
    console.log('📅 Setting up weekly activity tracking system...');
    
    // Read and execute the migration
    const fs = require('fs');
    const migrationPath = './migrations/022_weekly_activity_tracking.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Weekly activity tracking system created successfully!');
    console.log('');
    console.log('📊 Features:');
    console.log('   • Auto-aggregates daily data into weekly summaries');
    console.log('   • Auto-cleanup of old daily records');
    console.log('   • Philippines timezone support (GMT+8)');
    console.log('   • Week starts Monday, ends Sunday');
    console.log('');
    console.log('🔧 Available Functions:');
    console.log('   • aggregate_weekly_activity() - Aggregate current week');
    console.log('   • cleanup_old_daily_activity() - Delete old daily records');
    console.log('   • get_user_weekly_summary() - Get user weekly data');
    console.log('   • get_week_start_date() - Get Monday of week');
    console.log('   • get_week_end_date() - Get Sunday of week');
    
  } catch (error) {
    console.error('❌ Error setting up weekly tracking:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupWeeklyTracking().catch(console.error); 