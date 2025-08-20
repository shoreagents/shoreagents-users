const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runHealthCheckMigration() {
  const client = await pool.connect();
  try {
    console.log('🏥 Running Health Check Schema Migration...\n');
    
    // 1. Read the migration SQL file
    console.log('1️⃣ Reading migration file...');
    const fs = require('fs');
    const migrationSQL = fs.readFileSync('./migrations/045_health_check_schema.sql', 'utf8');
    console.log('   ✅ Migration file loaded');
    
    // 2. Execute the migration
    console.log('\n2️⃣ Executing migration...');
    await client.query(migrationSQL);
    console.log('   ✅ Migration executed successfully');
    
    // 3. Verify the tables were created
    console.log('\n3️⃣ Verifying tables...');
    
    const tables = [
      'health_check_requests',
      'health_check_records', 
      'health_check_availability'
    ];
    
    for (const tableName of tables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) as exists
      `, [tableName]);
      
      if (result.rows[0].exists) {
        console.log(`   ✅ Table '${tableName}' created successfully`);
      } else {
        console.log(`   ❌ Table '${tableName}' NOT found`);
      }
    }
    
    // 4. Check if functions were created
    console.log('\n4️⃣ Verifying functions...');
    
    const functions = [
      'notify_health_check_event',
      'update_updated_at_column'
    ];
    
    for (const funcName of functions) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM pg_proc 
          WHERE proname = $1
        ) as exists
      `, [funcName]);
      
      if (result.rows[0].exists) {
        console.log(`   ✅ Function '${funcName}' created successfully`);
      } else {
        console.log(`   ❌ Function '${funcName}' NOT found`);
      }
    }
    
    // 5. Check sample data
    console.log('\n5️⃣ Checking sample data...');
    
    const sampleData = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM health_check_availability) as availability_count,
        (SELECT COUNT(*) FROM health_check_records) as records_count
    `);
    
    console.log(`   ✅ Health check availability records: ${sampleData.rows[0].availability_count}`);
    console.log(`   ✅ Sample health check records: ${sampleData.rows[0].records_count}`);
    
    console.log('\n🎉 Health Check Migration Completed Successfully!');
    console.log('\n📋 What was created:');
    console.log('   • health_check_requests table');
    console.log('   • health_check_records table');
    console.log('   • health_check_availability table');
    console.log('   • Real-time notification triggers');
    console.log('   • Sample data for testing');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the migration
runHealthCheckMigration();
