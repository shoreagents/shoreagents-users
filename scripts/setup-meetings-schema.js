#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function setupMeetingsSchema() {
  try {
    console.log('🚀 Setting up meetings schema...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '027_meetings_schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded successfully');
    
    // Execute the migration
    const response = await fetch('http://localhost:3000/api/database/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: migrationSQL, 
        description: 'Setup meetings schema with tables, functions, and triggers' 
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Meetings schema setup completed successfully!');
      console.log('📊 Created:');
      console.log('   - meetings table');
      console.log('   - Indexes for performance');
      console.log('   - Updated_at trigger');
      console.log('   - Helper functions for CRUD operations');
      console.log('   - Statistics functions');
    } else {
      console.error('❌ Migration failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error setting up meetings schema:', error.message);
    console.log('\n💡 Make sure your Next.js app is running on port 3000');
    console.log('   Run: npm run dev');
  }
}

setupMeetingsSchema(); 