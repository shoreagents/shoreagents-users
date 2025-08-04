const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testProductivityScoring() {
  try {
    console.log('🧪 Testing productivity scoring system...');
    
    // Test 1: Get current month year
    console.log('\n1. Testing get_month_year() function...');
    const monthYearResult = await pool.query('SELECT get_month_year() as month_year');
    console.log('Current month_year:', monthYearResult.rows[0].month_year);
    
    // Test 2: Calculate productivity score for a user
    console.log('\n2. Testing productivity score calculation...');
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      console.log('Using user ID:', userId);
      
      const scoreResult = await pool.query(
        'SELECT calculate_monthly_productivity_score($1) as productivity_score',
        [userId]
      );
      console.log('Productivity score:', scoreResult.rows[0].productivity_score);
      
      // Test 3: Get user productivity scores
      console.log('\n3. Testing get_user_productivity_scores() function...');
      const scoresResult = await pool.query(
        'SELECT * FROM get_user_productivity_scores($1, 12)',
        [userId]
      );
      console.log('Productivity scores found:', scoresResult.rows.length);
      
      if (scoresResult.rows.length > 0) {
        console.log('Sample score:', {
          month_year: scoresResult.rows[0].month_year,
          productivity_score: scoresResult.rows[0].productivity_score,
          active_hours: scoresResult.rows[0].active_hours,
          inactive_hours: scoresResult.rows[0].inactive_hours
        });
      }
      
      // Test 4: Get average productivity
      console.log('\n4. Testing get_user_average_productivity() function...');
      const avgResult = await pool.query(
        'SELECT get_user_average_productivity($1, 12) as average_score',
        [userId]
      );
      console.log('Average productivity score:', avgResult.rows[0].average_score);
      
    } else {
      console.log('No users found in database');
    }
    
    // Test 5: Check table structure
    console.log('\n5. Checking productivity_scores table...');
    const tableResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'productivity_scores' 
      ORDER BY ordinal_position
    `);
    console.log('Table columns:');
    tableResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n✅ Productivity scoring system test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing productivity scoring:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testProductivityScoring().catch(console.error); 