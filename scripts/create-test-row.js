const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createTestRow() {
  console.log('🧪 Creating Test Row to Trigger INSERT Action\n');
  
  try {
    // Step 1: Get test user
    const userResult = await pool.query(`
      SELECT id, email, user_type
      FROM users 
      WHERE email LIKE '%@%' 
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No users found for testing!');
      return;
    }
    
    const testUser = userResult.rows[0];
    console.log('✅ Test user found:', `${testUser.email} (${testUser.user_type})`);
    
    // Step 2: Create a row for a future date (next week)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    console.log(`🆕 Creating test row for date: ${futureDateStr}`);
    
    // First, clean up any existing row for this date
    await pool.query(`
      DELETE FROM activity_data 
      WHERE user_id = $1 AND today_date = $2
    `, [testUser.id, futureDateStr]);
    
    // Create new row
    const insertResult = await pool.query(`
      INSERT INTO activity_data (
        user_id, is_currently_active, today_active_seconds, 
        today_inactive_seconds, today_date, last_session_start
      ) VALUES ($1, false, 0, 0, $2, NOW())
      RETURNING id, user_id, today_active_seconds, today_inactive_seconds, today_date
    `, [testUser.id, futureDateStr]);
    
    if (insertResult.rows.length === 0) {
      console.log('❌ Failed to create test row!');
      return;
    }
    
    const newRow = insertResult.rows[0];
    console.log('✅ Test row created successfully:');
    console.log(`   • ID: ${newRow.id}`);
    console.log(`   • Date: ${newRow.today_date}`);
    console.log(`   • Active: ${newRow.today_active_seconds}s`);
    console.log(`   • Inactive: ${newRow.today_inactive_seconds}s`);
    
    console.log('\n📡 This should trigger:');
    console.log('   1. Database trigger fires');
    console.log('   2. pg_notify("activity_data_change", data)');
    console.log('   3. Socket server receives INSERT notification');
    console.log('   4. Frontend automatically fetches new data');
    console.log('   5. UI updates without page reload');
    
    // Clean up after 5 seconds
    setTimeout(async () => {
      console.log('\n🧹 Cleaning up test row...');
      await pool.query(`
        DELETE FROM activity_data 
        WHERE id = $1
      `, [newRow.id]);
      console.log('✅ Test row cleaned up');
      await pool.end();
    }, 5000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    await pool.end();
  }
}

createTestRow();
