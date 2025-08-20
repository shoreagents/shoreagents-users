const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkJobInfoStructure() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking job_info table structure...\n');
    
    // Check table columns
    console.log('1️⃣ Table columns:');
    const columns = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'job_info'
      ORDER BY ordinal_position
    `);
    
    if (columns.rows.length > 0) {
      columns.rows.forEach((col, index) => {
        console.log(`   ${index + 1}. ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'Nullable' : 'Not Null'}`);
        if (col.column_default) {
          console.log(`      Default: ${col.column_default}`);
        }
      });
    }
    
    // Check current data
    console.log('\n2️⃣ Current data in job_info:');
    const data = await client.query(`
      SELECT 
        id,
        agent_user_id,
        internal_user_id,
        employee_id,
        job_title,
        shift_time,
        shift_period,
        shift_schedule
      FROM job_info
      ORDER BY id
    `);
    
    if (data.rows.length > 0) {
      data.rows.forEach((row, index) => {
        console.log(`   ${index + 1}. ID: ${row.id}`);
        console.log(`      Agent User ID: ${row.agent_user_id || 'NULL'}`);
        console.log(`      Internal User ID: ${row.internal_user_id || 'NULL'}`);
        console.log(`      Employee ID: ${row.employee_id || 'NULL'}`);
        console.log(`      Job Title: ${row.job_title || 'NULL'}`);
        console.log(`      Shift Time: ${row.shift_time || 'NULL'}`);
        console.log(`      Shift Period: ${row.shift_period || 'NULL'}`);
        console.log('');
      });
    }
    
    // Check foreign key constraints
    console.log('3️⃣ Foreign key constraints:');
    const constraints = await client.query(`
      SELECT 
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'job_info'
    `);
    
    if (constraints.rows.length > 0) {
      constraints.rows.forEach((constraint, index) => {
        console.log(`   ${index + 1}. ${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
      });
    } else {
      console.log('   No foreign key constraints found');
    }
    
    // Check indexes
    console.log('\n4️⃣ Indexes:');
    const indexes = await client.query(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'job_info'
    `);
    
    if (indexes.rows.length > 0) {
      indexes.rows.forEach((index, i) => {
        console.log(`   ${i + 1}. ${index.indexname}`);
        console.log(`      Definition: ${index.indexdef}`);
      });
    } else {
      console.log('   No indexes found');
    }
    
  } catch (error) {
    console.error('\n❌ Error checking job_info structure:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkJobInfoStructure();
