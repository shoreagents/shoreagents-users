const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'shoreagents_users',
  user: 'postgres',
  password: 'postgres',
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connecting to database...');
    console.log('✅ Connected to database');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '058_update_meeting_end_function.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📝 Running migration 058: Update meeting end function...');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        try {
          await client.query(statement);
          console.log('✅ Statement executed successfully');
        } catch (error) {
          console.log(`❌ Error executing statement ${i + 1}: ${error.message}`);
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    console.log('💡 Meeting functions updated for open-ended meetings');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
