const { Pool } = require('pg');

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function addColumns() {
  const pool = new Pool(databaseConfig);
  
  try {
    console.log('Adding time tracking columns to activity_data table...');
    
    // Add new columns
    await pool.query(`
      ALTER TABLE activity_data 
      ADD COLUMN IF NOT EXISTS today_active_seconds INTEGER DEFAULT 0
    `);
    
    await pool.query(`
      ALTER TABLE activity_data 
      ADD COLUMN IF NOT EXISTS today_inactive_seconds INTEGER DEFAULT 0
    `);
    
    await pool.query(`
      ALTER TABLE activity_data 
      ADD COLUMN IF NOT EXISTS last_session_start TIMESTAMP WITH TIME ZONE
    `);
    
    // Update the notification function
    await pool.query(`
      CREATE OR REPLACE FUNCTION notify_activity_change()
      RETURNS TRIGGER AS $$
      BEGIN
          PERFORM pg_notify(
              'activity_change',
              json_build_object(
                  'user_id', NEW.user_id,
                  'is_currently_active', NEW.is_currently_active,
                  'today_active_seconds', NEW.today_active_seconds,
                  'today_inactive_seconds', NEW.today_inactive_seconds,
                  'last_session_start', NEW.last_session_start,
                  'updated_at', NEW.updated_at
              )::text
          );
          RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    
    console.log('✅ Columns added successfully!');
    
    // Verify the columns exist
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'activity_data' 
      AND column_name IN ('today_active_seconds', 'today_inactive_seconds', 'last_session_start')
    `);
    
    console.log('Verification - Found columns:', result.rows.map(row => row.column_name));
    
  } catch (error) {
    console.error('❌ Error adding columns:', error);
  } finally {
    await pool.end();
  }
}

addColumns(); 