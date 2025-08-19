const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTableStructure() {
  try {
    console.log('🔍 Checking table structure...\n');
    
    // Check agents table structure
    console.log('📋 Agents Table Structure:');
    const agentsStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'agents'
      ORDER BY ordinal_position
    `);
    
    agentsStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    console.log('\n📋 Job Info Table Structure:');
    const jobInfoStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'job_info'
      ORDER BY ordinal_position
    `);
    
    jobInfoStructure.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check sample data
    console.log('\n📋 Sample Agents Data:');
    const agentsData = await pool.query('SELECT * FROM agents LIMIT 3');
    if (agentsData.rows.length > 0) {
      agentsData.rows.forEach((agent, index) => {
        console.log(`   ${index + 1}. ${JSON.stringify(agent, null, 2)}`);
      });
    } else {
      console.log('   ❌ No agents found');
    }
    
    console.log('\n📋 Sample Job Info Data:');
    const jobInfoData = await pool.query('SELECT * FROM job_info LIMIT 3');
    if (jobInfoData.rows.length > 0) {
      jobInfoData.rows.forEach((job, index) => {
        console.log(`   ${index + 1}. ${JSON.stringify(job, null, 2)}`);
      });
    } else {
      console.log('   ❌ No job info found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
