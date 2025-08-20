const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

(async function run() {
  try {
    console.log('🔎 Checking activity_data rows for yesterday/today (Manila)...');
    const { rows: nowRows } = await pool.query("SELECT (NOW() AT TIME ZONE 'Asia/Manila')::timestamp as now");
    const now = new Date(nowRows[0].now);
    const manilaToday = now.toISOString().slice(0,10);
    const d = new Date(now); d.setDate(d.getDate()-1);
    const manilaYesterday = d.toISOString().slice(0,10);
    console.log(`   Today: ${manilaToday} | Yesterday: ${manilaYesterday}`);

    const { rows } = await pool.query(`
      SELECT user_id, today_date, is_currently_active, today_active_seconds, today_inactive_seconds, updated_at
      FROM activity_data
      WHERE today_date = $1 OR today_date = $2
      ORDER BY user_id, today_date
    `, [manilaYesterday, manilaToday]);

    if (!rows.length) {
      console.log('   (no rows)');
      return;
    }

    let lastUser = null;
    for (const r of rows) {
      if (r.user_id !== lastUser) {
        console.log(`\n👤 user_id=${r.user_id}`);
        lastUser = r.user_id;
      }
      console.log(`  • ${r.today_date} | active=${r.today_active_seconds}s inactive=${r.today_inactive_seconds}s active_now=${r.is_currently_active} updated=${new Date(r.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await pool.end();
  }
})();
