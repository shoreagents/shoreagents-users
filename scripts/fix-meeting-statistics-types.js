const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔧 Fixing meeting statistics function type mismatch...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/029_fix_meeting_statistics_types.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Send the migration to the API
    const response = await fetch((process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/api/database/migrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: sql,
        description: 'Fix type mismatch in get_meeting_statistics function'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Migration applied successfully:', result);
    } else {
      const error = await response.json();
      console.error('❌ Migration failed:', error);
    }
  } catch (error) {
    console.error('❌ Error running migration:', error);
  }
}

runMigration(); 