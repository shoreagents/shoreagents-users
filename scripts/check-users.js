const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...\n');
    
    // Check users table
    const usersResult = await pool.query('SELECT id, email, user_type, created_at FROM users ORDER BY created_at DESC LIMIT 10');
    console.log('📋 Users in database:');
    if (usersResult.rows.length === 0) {
      console.log('   No users found in database');
    } else {
      usersResult.rows.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.user_type}) - ID: ${user.id}`);
      });
    }
    
    console.log('\n📊 User statistics:');
    const statsResult = await pool.query(`
      SELECT 
        user_type,
        COUNT(*) as count
      FROM users 
      GROUP BY user_type
    `);
    
    statsResult.rows.forEach(stat => {
      console.log(`   ${stat.user_type}: ${stat.count} users`);
    });
    
    console.log('\n💡 For password reset testing, use one of the email addresses above.');
    console.log('   Make sure the email exists in both the database AND Supabase auth.');
    
  } catch (error) {
    console.error('❌ Error checking users:', error);
  } finally {
    await pool.end();
  }
}

checkUsers(); 