const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const USER_ID = 2; // Adjust if needed
const SHIFT_TIME = '6:00 AM - 3:00 PM';

function fmt(d) {
  return new Date(d).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

async function getWindows() {
  const { rows } = await pool.query('SELECT * FROM calculate_break_windows($1)', [SHIFT_TIME]);
  if (!rows.length) throw new Error('No break windows');
  return rows[0];
}

function makeDate(timeStr) {
  const today = new Date().toISOString().slice(0, 10);
  return `${today} ${timeStr}`;
}

async function checkAt(label, dt, breakType) {
  const sql = `
    SELECT 
      is_break_available_soon($1, $2::break_type_enum, $3::timestamp) as available_soon,
      (CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_break_available_now') THEN is_break_available_now($1, $2::break_type_enum, $3::timestamp) ELSE false END) as available_now,
      (CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_break_reminder_due') THEN is_break_reminder_due($1, $2::break_type_enum, $3::timestamp) ELSE false END) as mid_window_reminder,
      (CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_break_window_ending_soon') THEN is_break_window_ending_soon($1, $2::break_type_enum, $3::timestamp) ELSE false END) as ending_soon,
      is_break_missed($1, $2::break_type_enum, $3::timestamp) as missed
  `;
  const { rows } = await pool.query(sql, [USER_ID, breakType, dt]);
  const r = rows[0];
  const flags = Object.entries(r).filter(([,v]) => v).map(([k]) => k);
  return { label, at: dt, breakType, ...r, flags };
}

async function run() {
  try {
    console.log('🧪 Running comprehensive break notification tests...');
    const w = await getWindows();

    const scenarios = [
      { breakType: 'Morning', start: w.morning_start, end: w.morning_end },
      { breakType: 'Lunch', start: w.lunch_start, end: w.lunch_end },
      { breakType: 'Afternoon', start: w.afternoon_start, end: w.afternoon_end },
    ];

    const results = [];

    for (const sc of scenarios) {
      const start = sc.start; // HH:MM:SS
      const end = sc.end; // HH:MM:SS

      // Build test times
      const dtSoon = makeDate(addMinutesStr(start, -15)); // 15m before start
      const dtStart = makeDate(start);                    // at start
      const dtMid30 = makeDate(addMinutesStr(start, 30)); // 30m after start
      const dtEndSoon = makeDate(addMinutesStr(end, -15));// 15m before end
      const dtPostEnd = makeDate(addMinutesStr(end, 1));  // 1m after end

      results.push(await checkAt(`${sc.breakType} available soon`, dtSoon, sc.breakType));
      results.push(await checkAt(`${sc.breakType} available now`, dtStart, sc.breakType));
      results.push(await checkAt(`${sc.breakType} 30-min reminder`, dtMid30, sc.breakType));
      results.push(await checkAt(`${sc.breakType} ending soon`, dtEndSoon, sc.breakType));
      results.push(await checkAt(`${sc.breakType} missed after end`, dtPostEnd, sc.breakType));
    }

    // Output
    for (const r of results) {
      console.log(`\n— ${r.label} @ ${fmt(r.at)} [${r.breakType}]`);
      console.log(`   available_soon=${r.available_soon} available_now=${r.available_now} mid_window_reminder=${r.mid_window_reminder} ending_soon=${r.ending_soon} missed=${r.missed}`);
      console.log(`   triggers: ${r.flags.join(', ') || '(none)'}`);
    }

    // Optionally create one notification per category to ensure pipeline works
    console.log('\n🔔 Creating sample notifications for pipeline verification...');
    await pool.query(`DELETE FROM notifications WHERE user_id=$1 AND category='break' AND created_at > NOW() - INTERVAL '2 minutes'`, [USER_ID]);

    // Pick first hits for each category
    const pick = (key) => results.find(r => r[key]);
    const samples = [
      pick('available_soon') && { type: 'available_soon', breakType: pick('available_soon').breakType },
      pick('available_now') && { type: 'break_available', breakType: pick('available_now').breakType },
      pick('mid_window_reminder') && { type: 'missed_break', breakType: pick('mid_window_reminder').breakType },
      pick('ending_soon') && { type: 'ending_soon', breakType: pick('ending_soon').breakType },
      pick('missed') && { type: 'missed_break', breakType: pick('missed').breakType },
    ].filter(Boolean);

    for (const s of samples) {
      await pool.query(`SELECT create_break_reminder_notification($1, $2, $3::break_type_enum)`, [USER_ID, s.type, s.breakType]);
      console.log(`   ✅ Created: ${s.type} (${s.breakType})`);
    }

    console.log('\n✅ Comprehensive test completed.');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
  } finally {
    await pool.end();
  }
}

function addMinutesStr(timeStr, delta) {
  // timeStr HH:MM:SS
  const [h, m, s] = timeStr.split(':').map(Number);
  const base = new Date(`1970-01-01T${pad2(h)}:${pad2(m)}:${pad2(s || 0)}Z`);
  const out = new Date(base.getTime() + delta * 60 * 1000);
  return `${pad2(out.getUTCHours())}:${pad2(out.getUTCMinutes())}:${pad2(out.getUTCSeconds())}`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

run();
