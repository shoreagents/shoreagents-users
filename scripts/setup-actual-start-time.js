#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function setupActualStartTime() {
  try {
    console.log('🚀 Setting up actual start time tracking...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '028_add_actual_start_time.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded successfully');
    
    // Execute the migration
    const response = await fetch('http://localhost:3000/api/database/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: migrationSQL, 
        description: 'Add actual_start_time column and update functions to track when meetings are actually started' 
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Actual start time tracking setup completed successfully!');
      console.log('📊 Created:');
      console.log('   - actual_start_time column in meetings table');
      console.log('   - Updated start_meeting function to record actual start time');
      console.log('   - Updated get_user_meetings function to include actual_start_time');
      console.log('   - Updated get_active_meeting function to include actual_start_time');
    } else {
      console.error('❌ Migration failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error setting up actual start time tracking:', error.message);
    console.log('\n💡 Make sure your Next.js app is running on port 3000');
    console.log('   Run: npm run dev');
  }
}

setupActualStartTime(); 