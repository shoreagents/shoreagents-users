const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUsersTableStructure() {
  try {
    console.log('🔍 Checking users table structure...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Users table columns:');
    result.rows.forEach(row => {
      console.log(`   • ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n📊 Sample user data:');
    const sampleUser = await pool.query(`
      SELECT * FROM users LIMIT 1
    `);
    
    if (sampleUser.rows.length > 0) {
      const user = sampleUser.rows[0];
      Object.keys(user).forEach(key => {
        console.log(`   • ${key}: ${user[key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsersTableStructure();
