const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkUsersTableStructure() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking users table structure...\n');
    
    // Check users table structure
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
    
    console.log('📋 users table structure:');
    if (tableStructure.rows.length > 0) {
      tableStructure.rows.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'Nullable' : 'Not Null'}`);
        if (col.column_default) {
          console.log(`        Default: ${col.column_default}`);
        }
      });
    } else {
      console.log('   No columns found');
    }
    
    // Check agents table structure
    console.log('\n📋 agents table structure:');
    const agentsStructure = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'agents'
      ORDER BY ordinal_position
    `);
    
    if (agentsStructure.rows.length > 0) {
      agentsStructure.rows.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'Nullable' : 'Not Null'}`);
        if (col.column_default) {
          console.log(`        Default: ${col.column_default}`);
        }
      });
    } else {
      console.log('   No columns found');
    }
    
    // Check sample data
    console.log('\n📊 Sample users data:');
    const sampleUsers = await client.query(`
      SELECT id, user_type FROM users LIMIT 5
    `);
    
    if (sampleUsers.rows.length > 0) {
      sampleUsers.rows.forEach((user, index) => {
        console.log(`   User ${index + 1}: ID=${user.id} (${typeof user.id}), Type=${user.user_type}`);
      });
    }
    
    // Check sample agents data
    console.log('\n📊 Sample agents data:');
    const sampleAgents = await client.query(`
      SELECT user_id FROM agents LIMIT 5
    `);
    
    if (sampleAgents.rows.length > 0) {
      sampleAgents.rows.forEach((agent, index) => {
        console.log(`   Agent ${index + 1}: user_id=${agent.user_id} (${typeof agent.user_id})`);
      });
    }
    
  } catch (error) {
    console.error('\n❌ Error checking users table:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkUsersTableStructure();
