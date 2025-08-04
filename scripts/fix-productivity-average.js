const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixProductivityAverage() {
  try {
    console.log('🔧 Fixing productivity average function...');
    
    // Drop the existing function and recreate it
    await pool.query('DROP FUNCTION IF EXISTS get_user_average_productivity(INTEGER, INTEGER)');
    
    // Create the fixed function
    const fixedFunction = `
      CREATE OR REPLACE FUNCTION get_user_average_productivity(
          target_user_id INTEGER,
          months_back INTEGER DEFAULT 12
      )
      RETURNS DECIMAL(5,2) AS $$
      DECLARE
          avg_score DECIMAL(5,2);
          cutoff_date DATE;
      BEGIN
          -- Calculate cutoff date (months_back months ago)
          cutoff_date := (NOW() AT TIME ZONE 'Asia/Manila')::date - (months_back * 30);
          
          SELECT AVG(productivity_score) INTO avg_score
          FROM productivity_scores 
          WHERE user_id = target_user_id
          AND month_year >= TO_CHAR(cutoff_date, 'YYYY-MM');
          
          RETURN COALESCE(ROUND(avg_score, 2), 0.00);
      END;
      $$ language 'plpgsql';
    `;
    
    await pool.query(fixedFunction);
    
    console.log('✅ Productivity average function fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing productivity average function:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixProductivityAverage().catch(console.error); 