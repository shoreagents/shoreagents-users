const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testCleanupLogic() {
  try {
    console.log('🔍 Testing cleanup logic...');
    
    // Get current week dates
    const weekStartResult = await pool.query('SELECT get_week_start_date() as week_start');
    const weekEndResult = await pool.query('SELECT get_week_end_date() as week_end');
    const weekStart = weekStartResult.rows[0].week_start;
    const weekEnd = weekEndResult.rows[0].week_end;
    
    console.log('📅 Current week:', weekStart, 'to', weekEnd);
    
    // Calculate cutoff date
    const cutoffDate = new Date(weekStart);
    cutoffDate.setDate(cutoffDate.getDate() - 7); // 1 week back
    console.log('🗑️ Cutoff date (1 week back):', cutoffDate.toISOString().split('T')[0]);
    
    // Check what data exists
    const allDataResult = await pool.query('SELECT today_date, COUNT(*) as count FROM activity_data GROUP BY today_date ORDER BY today_date');
    console.log('📊 All activity data dates:');
    allDataResult.rows.forEach(row => {
      console.log(`  ${row.today_date}: ${row.count} records`);
    });
    
    // Check what would be deleted
    const wouldDeleteResult = await pool.query(
      'SELECT today_date, COUNT(*) as count FROM activity_data WHERE today_date < $1 GROUP BY today_date ORDER BY today_date',
      [cutoffDate.toISOString().split('T')[0]]
    );
    
    console.log('🗑️ Records that would be deleted:');
    if (wouldDeleteResult.rows.length > 0) {
      wouldDeleteResult.rows.forEach(row => {
        console.log(`  ${row.today_date}: ${row.count} records`);
      });
    } else {
      console.log('  No records would be deleted');
    }
    
    // Test the actual cleanup function
    console.log('\n🧪 Testing actual cleanup function...');
    const cleanupResult = await pool.query('SELECT cleanup_old_daily_activity(1) as deleted_count');
    console.log('✅ Cleanup result:', cleanupResult.rows[0].deleted_count, 'records deleted');
    
  } catch (error) {
    console.error('❌ Error testing cleanup logic:', error);
  } finally {
    await pool.end();
  }
}

testCleanupLogic().catch(console.error); 