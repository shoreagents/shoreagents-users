require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkTableStructure() {
  try {
    console.log('🔍 Checking table structure...');
    
    // Check team_conversations table
    console.log('\n📋 team_conversations table:');
    const teamConvResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'team_conversations'
      ORDER BY ordinal_position;
    `);
    console.table(teamConvResult.rows);
    
    // Check conversation_participants table
    console.log('\n📋 conversation_participants table:');
    const participantsResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'conversation_participants'
      ORDER BY ordinal_position;
    `);
    console.table(participantsResult.rows);
    
    // Check users table
    console.log('\n📋 users table:');
    const usersResult = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.table(usersResult.rows);
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
