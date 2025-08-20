const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkBreakSessionsStructure() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking break_sessions table structure...\n');
    
    // Check if table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'break_sessions'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('❌ break_sessions table does not exist');
      return;
    }
    
    // Get table structure
    const tableStructure = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'break_sessions'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 break_sessions table structure:');
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
    
    // Check for sample data
    const sampleData = await client.query(`
      SELECT * FROM break_sessions LIMIT 3
    `);
    
    if (sampleData.rows.length > 0) {
      console.log('\n📊 Sample data:');
      sampleData.rows.forEach((row, index) => {
        console.log(`   Row ${index + 1}:`, row);
      });
    } else {
      console.log('\n📊 No data in break_sessions table');
    }
    
  } catch (error) {
    console.error('\n❌ Error checking break_sessions:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkBreakSessionsStructure();
