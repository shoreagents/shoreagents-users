require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUserActivityData() {
  try {
    console.log('🔍 Checking user activity data...');
    
    // Check all users
    console.log('\n👥 All users in database:');
    const usersResult = await pool.query('SELECT id, email FROM users ORDER BY id');
    usersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}`);
    });
    
    // Check all activity_data records
    console.log('\n📊 All activity_data records:');
    const allActivityResult = await pool.query(
      `SELECT 
        ad.id,
        ad.user_id,
        u.email,
        ad.today_date,
        ad.today_active_seconds,
        ad.today_inactive_seconds,
        ad.is_currently_active,
        ad.last_session_start
       FROM activity_data ad
       LEFT JOIN users u ON ad.user_id = u.id
       ORDER BY ad.today_date DESC, ad.user_id`
    );
    
    if (allActivityResult.rows.length === 0) {
      console.log('❌ No activity_data records found');
    } else {
      allActivityResult.rows.forEach(row => {
        console.log(`  - User: ${row.email} (ID: ${row.user_id}), Date: ${row.today_date}, Active: ${row.today_active_seconds || 0}s, Inactive: ${row.today_inactive_seconds || 0}s, Currently Active: ${row.is_currently_active}`);
      });
    }
    
    // Check productivity_scores records
    console.log('\n🎯 All productivity_scores records:');
    const allProductivityResult = await pool.query(
      `SELECT 
        ps.id,
        ps.user_id,
        u.email,
        ps.month_year,
        ps.productivity_score,
        ps.total_active_seconds,
        ps.total_inactive_seconds
       FROM productivity_scores ps
       LEFT JOIN users u ON ps.user_id = u.id
       ORDER BY ps.month_year DESC, ps.user_id`
    );
    
    if (allProductivityResult.rows.length === 0) {
      console.log('❌ No productivity_scores records found');
    } else {
      allProductivityResult.rows.forEach(row => {
        console.log(`  - User: ${row.email} (ID: ${row.user_id}), Month: ${row.month_year}, Score: ${row.productivity_score}%, Active: ${row.total_active_seconds || 0}s, Inactive: ${row.total_inactive_seconds || 0}s`);
      });
    }
    
    // Test the actual API call that the frontend makes
    console.log('\n🧪 Testing productivity API call...');
    const testUser = usersResult.rows[0]; // Use first user
    if (testUser) {
      // Simulate the API call
      console.log(`Testing with user: ${testUser.email} (ID: ${testUser.id})`);
      
      // Test calculate_monthly_productivity_score function
      try {
        const calculateResult = await pool.query(
          'SELECT calculate_monthly_productivity_score($1) as productivity_score',
          [testUser.id]
        );
        console.log(`✅ Calculated productivity score: ${calculateResult.rows[0].productivity_score}%`);
      } catch (error) {
        console.log(`❌ Error calculating productivity score: ${error.message}`);
      }
      
      // Test get_user_productivity_scores function
      try {
        const scoresResult = await pool.query(
          'SELECT * FROM get_user_productivity_scores($1, $2)',
          [testUser.id, 12]
        );
        console.log(`✅ User productivity scores: ${scoresResult.rows.length} records found`);
        scoresResult.rows.forEach(score => {
          console.log(`  - Month: ${score.month_year}, Score: ${score.productivity_score}%`);
        });
      } catch (error) {
        console.log(`❌ Error getting user productivity scores: ${error.message}`);
      }
      
      // Test get_user_average_productivity function
      try {
        const avgResult = await pool.query(
          'SELECT get_user_average_productivity($1, $2) as average_score',
          [testUser.id, 12]
        );
        console.log(`✅ Average productivity score: ${avgResult.rows[0].average_score}%`);
      } catch (error) {
        console.log(`❌ Error getting average productivity: ${error.message}`);
      }
      
      // Check current month/year
      try {
        const monthYearResult = await pool.query('SELECT get_month_year() as month_year');
        console.log(`✅ Current month_year: ${monthYearResult.rows[0].month_year}`);
      } catch (error) {
        console.log(`❌ Error getting month_year: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserActivityData();