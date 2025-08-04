const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupMonthlyTracking() {
  try {
    console.log('📅 Setting up monthly activity tracking system...');
    
    // Read and execute the migration
    const fs = require('fs');
    const migrationPath = './migrations/023_monthly_activity_tracking.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Monthly activity tracking system created successfully!');
    console.log('');
    console.log('📊 Features:');
    console.log('   • Auto-aggregates daily data into monthly summaries');
    console.log('   • Auto-cleanup of old daily records');
    console.log('   • Philippines timezone support (GMT+8)');
    console.log('   • Month starts 1st day, ends last day');
    console.log('');
    console.log('🔧 Available Functions:');
    console.log('   • aggregate_monthly_activity() - Aggregate current month');
    console.log('   • cleanup_old_daily_activity_monthly() - Delete old daily records');
    console.log('   • get_user_monthly_summary() - Get user monthly data');
    console.log('   • get_month_start_date() - Get 1st day of month');
    console.log('   • get_month_end_date() - Get last day of month');
    
  } catch (error) {
    console.error('❌ Error setting up monthly tracking:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupMonthlyTracking().catch(console.error); 