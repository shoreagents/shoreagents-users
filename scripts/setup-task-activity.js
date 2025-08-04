const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

console.log('🚀 Setting up Task Activity Schema...');

// Database connection using DATABASE_URL from .env.local
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/025_task_activity_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the entire migration as one statement
    console.log('Executing migration...');
    await pool.query(migrationSQL);
    
    console.log('✅ Task Activity Schema setup completed successfully!');
  } catch (error) {
    console.error('❌ Task Activity Schema setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration(); 