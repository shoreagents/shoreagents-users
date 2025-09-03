const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function runMigration() {
  const pool = new Pool(databaseConfig);
  
  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();
    
    console.log('✅ Connected to database');
    console.log('📝 Running migration 059: Fix break duration calculation trigger...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '059_fix_break_duration_trigger.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration 059 completed successfully!');
    console.log('🎯 Break duration calculation trigger has been created');
    console.log('🔄 Existing break sessions with missing duration have been updated');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration().then(() => {
  console.log('\n🏁 Migration completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
