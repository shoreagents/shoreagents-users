const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyPrecreate() {
  try {
    console.log('🔧 Applying pre-create next-day activity rows function...');
    const sqlPath = path.join(__dirname, 'activity-precreate.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('   ✅ Function created: precreate_next_day_activity_rows');

    console.log('🧪 Running precreate for current time...');
    const { rows } = await pool.query('SELECT precreate_next_day_activity_rows() AS created');
    console.log(`   ✅ Created rows: ${rows[0].created}`);

    console.log('\nℹ️ To integrate with scheduler, call this every 2 minutes after check_break_reminders.');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await pool.end();
  }
}

applyPrecreate();
