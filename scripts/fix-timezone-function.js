const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixTimezoneFunction() {
  try {
    console.log('🕐 Fixing timezone function to use Philippines timezone...');
    
    // Update the function without dropping it (to avoid dependency issues)
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          -- Store timestamp in UTC but ensure it's created in Philippines timezone context
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    // Create helper functions for Philippines timezone
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_philippines_timestamp(timestamp_with_timezone TIMESTAMP WITH TIME ZONE)
      RETURNS TIMESTAMP WITH TIME ZONE AS $$
      BEGIN
          -- Convert the timestamp to Philippines timezone for display
          RETURN timestamp_with_timezone AT TIME ZONE 'Asia/Manila';
      END;
      $$ language 'plpgsql';
    `);
    
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_current_philippines_time()
      RETURNS TIMESTAMP WITH TIME ZONE AS $$
      BEGIN
          -- Get current time in Philippines timezone
          RETURN NOW() AT TIME ZONE 'Asia/Manila';
      END;
      $$ language 'plpgsql';
    `);
    
    console.log('✅ Timezone function fixed successfully!');
    console.log('📅 Timestamps will now be stored correctly');
    console.log('🕐 Use get_philippines_timestamp() to display in Philippines timezone');
    
  } catch (error) {
    console.error('❌ Error fixing timezone function:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixTimezoneFunction().catch(console.error); 