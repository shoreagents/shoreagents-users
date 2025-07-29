const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  // Get migration file from command line argument
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('❌ Usage: node scripts/run-migration.js <migration-file>');
    process.exit(1);
  }

  const migrationPath = path.resolve(migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Read migration file
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log(`📝 Running migration: ${path.basename(migrationFile)}`);
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration(); 