const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUsersTable() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking users table structure...\n');
    
    // 1. Check table structure
    console.log('1️⃣ Users table columns:');
    const tableStructure = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    tableStructure.rows.forEach((col, index) => {
      console.log(`     ${index + 1}. ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
    });
    
    // 2. Check sample data
    console.log('\n2️⃣ Sample user data:');
    const userData = await client.query(`
      SELECT * FROM users LIMIT 5
    `);
    
    console.log(`   Found ${userData.rows.length} users:`);
    userData.rows.forEach((user, index) => {
      console.log(`     ${index + 1}. ID: ${user.id}, Email: ${user.email || 'N/A'}, Role: ${user.role || 'N/A'}`);
      // Show all columns for the first user
      if (index === 0) {
        console.log('        All columns:', Object.keys(user));
      }
    });
    
  } catch (error) {
    console.error('\n❌ Error checking users table:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkUsersTable();
