const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupProductivityScoring() {
  try {
    console.log('📊 Setting up productivity scoring system...');
    
    // Read and execute the migration
    const fs = require('fs');
    const migrationPath = './migrations/024_productivity_scoring.sql';
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Productivity scoring system created successfully!');
    console.log('');
    console.log('📈 Features:');
    console.log('   • Monthly productivity scores (0-100)');
    console.log('   • Based on active vs inactive time ratio');
    console.log('   • Stores month_year format (YYYY-MM)');
    console.log('   • Philippines timezone support (GMT+8)');
    console.log('');
    console.log('🔧 Available Functions:');
    console.log('   • calculate_monthly_productivity_score() - Calculate score for a month');
    console.log('   • get_user_productivity_scores() - Get user scores history');
    console.log('   • get_user_average_productivity() - Get average score');
    console.log('   • calculate_productivity_score() - Calculate score from active/inactive');
    console.log('   • get_month_year() - Get month_year string from date');
    console.log('');
    console.log('📋 Table Structure:');
    console.log('   • productivity_scores (id, user_id, month_year, productivity_score)');
    console.log('   • Unique constraint on (user_id, month_year)');
    console.log('   • Stores active/inactive seconds and percentages');
    
  } catch (error) {
    console.error('❌ Error setting up productivity scoring:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupProductivityScoring().catch(console.error); 