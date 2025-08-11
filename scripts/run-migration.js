const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get migration file from command line argument
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Please provide a migration file name');
  console.log('Usage: node scripts/run-migration.js <migration-file>');
  console.log('Example: node scripts/run-migration.js 027_fix_break_duration_calculation.sql');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'migrations', migrationFile);

if (!fs.existsSync(migrationPath)) {
  console.error(`❌ Migration file not found: ${migrationPath}`);
  process.exit(1);
}

console.log(`🔄 Running migration: ${migrationFile}`);

// Read the migration file
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Execute the migration using psql
const command = `psql -h localhost -U postgres -d shoreagents_users -c "${migrationSQL}"`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Migration failed:', error.message);
    if (stderr) {
      console.error('Error details:', stderr);
    }
    process.exit(1);
  }

  console.log('✅ Migration completed successfully!');
  console.log('Output:', stdout);
}); 