require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkProductivitySchema() {
  try {
    console.log('🔍 Checking productivity-related database schema...');
    
    // Check what tables exist
    console.log('\n📋 Available tables:');
    const tablesResult = await pool.query(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       ORDER BY table_name`
    );
    
    const tableNames = tablesResult.rows.map(row => row.table_name);
    tableNames.forEach(table => {
      console.log(`  - ${table}`);
    });
    
    // Check for productivity-related tables
    console.log('\n🎯 Productivity-related tables:');
    const productivityTables = tableNames.filter(table => 
      table.includes('activity') || 
      table.includes('productivity') || 
      table.includes('monthly') || 
      table.includes('weekly')
    );
    
    if (productivityTables.length === 0) {
      console.log('❌ No productivity-related tables found!');
    } else {
      productivityTables.forEach(table => {
        console.log(`  ✅ ${table}`);
      });
    }
    
    // Check if activity_data table exists and its structure
    if (tableNames.includes('activity_data')) {
      console.log('\n📊 activity_data table structure:');
      const activityDataColumns = await pool.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns 
         WHERE table_name = 'activity_data' 
         AND table_schema = 'public'
         ORDER BY ordinal_position`
      );
      
      activityDataColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Check if there's any data in activity_data
      const activityDataCount = await pool.query('SELECT COUNT(*) as count FROM activity_data');
      console.log(`  📈 Total records: ${activityDataCount.rows[0].count}`);
    } else {
      console.log('\n❌ activity_data table does not exist!');
    }
    
    // Check available functions
    console.log('\n🔧 Available functions:');
    const functionsResult = await pool.query(
      `SELECT routine_name 
       FROM information_schema.routines 
       WHERE routine_schema = 'public' 
       AND (routine_name LIKE '%productivity%' OR 
            routine_name LIKE '%activity%' OR 
            routine_name LIKE '%monthly%' OR 
            routine_name LIKE '%weekly%')
       ORDER BY routine_name`
    );
    
    if (functionsResult.rows.length === 0) {
      console.log('❌ No productivity/activity functions found!');
    } else {
      functionsResult.rows.forEach(row => {
        console.log(`  ✅ ${row.routine_name}`);
      });
    }
    
    // Check what migrations have been run
    console.log('\n🗃️ Migration status:');
    if (tableNames.includes('schema_migrations') || tableNames.includes('migrations')) {
      const migrationTable = tableNames.includes('schema_migrations') ? 'schema_migrations' : 'migrations';
      const migrationsResult = await pool.query(`SELECT * FROM ${migrationTable} ORDER BY version DESC LIMIT 10`);
      migrationsResult.rows.forEach(row => {
        console.log(`  - ${row.version || row.id}: ${row.name || 'No name'}`);
      });
    } else {
      console.log('❌ No migration tracking table found');
    }
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  } finally {
    await pool.end();
  }
}

checkProductivitySchema();