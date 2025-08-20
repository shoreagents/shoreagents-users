const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function fmtPH(dt) {
  return new Date(dt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
}

function parseAmPmToMinutes(token) {
  const [hhmm, ampm] = token.trim().toUpperCase().split(/\s+/);
  const [hhStr, mmStr] = hhmm.split(':');
  let hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  if (ampm === 'AM') {
    if (hh === 12) hh = 0;
  } else {
    if (hh !== 12) hh += 12;
  }
  return hh * 60 + mm;
}

function hhmmssToMinutes(hms) {
  const [h, m, s] = hms.split(':').map(Number);
  return h * 60 + m + Math.floor((s || 0) / 60);
}

function minutesToHhmmss(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function withinTolerance(tsA, tsB, toleranceMinutes = 3) {
  const a = new Date(tsA).getTime();
  const b = new Date(tsB).getTime();
  const diff = Math.abs(a - b) / (1000 * 60);
  return diff <= toleranceMinutes;
}

async function main() {
  try {
    const emailArg = process.argv[2] || null;
    if (!emailArg) {
      console.log('Usage: node scripts/test-user-break-notifications.js <user-email> [daysBack=1]');
      process.exit(1);
    }
    const daysBack = parseInt(process.argv[3] || '1', 10);

    console.log(`🔍 Testing break notifications for: ${emailArg}`);

    // Resolve user
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [emailArg]);
    if (!userRes.rows.length) {
      console.log('❌ User not found');
      return;
    }
    const userId = userRes.rows[0].id;

    // Shift info
    const shiftInfoRes = await pool.query('SELECT * FROM get_agent_shift_info($1)', [userId]);
    if (!shiftInfoRes.rows.length) {
      console.log('❌ No shift info');
      return;
    }
    const shiftInfo = shiftInfoRes.rows[0];
    const shiftText = shiftInfo.shift_time;
    console.log(`   Shift Time: ${shiftText}`);
    console.log(`   Shift Period: ${shiftInfo.shift_period}`);
    console.log(`   Shift Schedule: ${shiftInfo.shift_schedule}`);

    // Determine day/night
    const parts = String(shiftText || '').split(' - ');
    if (parts.length !== 2) {
      console.log('❌ Unparsable shift_time format');
      return;
    }
    const startMinutes = parseAmPmToMinutes(parts[0]);
    const endMinutes = parseAmPmToMinutes(parts[1]);
    const isNightShift = startMinutes > endMinutes;

    // Break windows
    const windowsRes = await pool.query('SELECT * FROM calculate_break_windows($1)', [shiftText]);
    const w = windowsRes.rows[0];

    console.log('\n🪟 Break Windows (server-calculated):');
    console.log(`   Morning   : ${w.morning_start} - ${w.morning_end}`);
    console.log(`   Lunch     : ${w.lunch_start} - ${w.lunch_end}`);
    console.log(`   Afternoon : ${w.afternoon_start} - ${w.afternoon_end}`);

    // Expected notification moments (Manila date today) – build Y-M-D from Manila clock to avoid UTC shift
    const nowPH = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const todayPH = `${nowPH.getFullYear()}-${String(nowPH.getMonth()+1).padStart(2,'0')}-${String(nowPH.getDate()).padStart(2,'0')}`;

    const types = isNightShift
      ? [
          { id: 'NightFirst', start: w.morning_start, end: w.morning_end },
          { id: 'NightMeal', start: w.lunch_start, end: w.lunch_end },
          { id: 'NightSecond', start: w.afternoon_start, end: w.afternoon_end },
        ]
      : [
          { id: 'Morning', start: w.morning_start, end: w.morning_end },
          { id: 'Lunch', start: w.lunch_start, end: w.lunch_end },
          { id: 'Afternoon', start: w.afternoon_start, end: w.afternoon_end },
        ];

    const expected = [];
    for (const t of types) {
      const startMin = hhmmssToMinutes(t.start);
      const endMin = hhmmssToMinutes(t.end);
      const evt = (label, timeMin) => ({ label, when: `${todayPH} ${minutesToHhmmss(timeMin)}`, breakType: t.id });

      // available soon (15m before)
      expected.push(evt('available_soon', Math.max(0, startMin - 15)));
      // available now
      expected.push(evt('break_available', startMin));
      // 30-minute reminders inside window (start+30, start+60, ... < end)
      for (let m = startMin + 30; m < endMin; m += 30) {
        expected.push(evt('missed_break', m));
      }
      // ending soon (15m before end)
      expected.push(evt('ending_soon', Math.max(0, endMin - 15)));
    }

    console.log('\n🗓️ Expected notification moments (approx):');
    expected.forEach(e => console.log(`   - ${e.breakType} ${e.label} @ ${e.when}`));

    // Actual notifications from DB (last N days)
    const actualRes = await pool.query(
      `SELECT id, category, type, title, message, payload, created_at
       FROM notifications
       WHERE user_id = $1 AND category = 'break' AND created_at > (NOW() - ($2::int || ' days')::interval)
       ORDER BY created_at DESC`,
      [userId, daysBack]
    );
    const actual = actualRes.rows.map(r => ({ ...r, breakType: r.payload?.break_type || r.payload?.['break_type'] || r.payload?.['breakType'] || null }));

    console.log(`\n📥 Actual notifications in last ${daysBack} day(s): ${actual.length}`);
    actual.slice(0, 30).forEach(n => {
      console.log(`   - ${fmtPH(n.created_at)} | ${n.payload?.reminder_type || n.type} | ${n.breakType} | ${n.title}`);
    });

    // Match expected vs actual (±3 min tolerance)
    const unmatched = [];
    const matched = [];

    for (const e of expected) {
      const a = actual.find(n => {
        const sameType = (n.payload?.reminder_type || n.type) === e.label;
        const sameBreak = (n.breakType || '').toString() === e.breakType;
        if (!sameType || !sameBreak) return false;
        return withinTolerance(n.created_at, e.when, 3);
      });
      if (a) matched.push({ e, a }); else unmatched.push(e);
    }

    console.log(`\n✅ Matched (±3m): ${matched.length}`);
    matched.slice(0, 20).forEach(m => console.log(`   - ${m.e.breakType} ${m.e.label} @ ${m.e.when} ≈ ${fmtPH(m.a.created_at)}`));

    console.log(`\n❌ Missing/late (no match within ±3m): ${unmatched.length}`);
    unmatched.slice(0, 20).forEach(e => console.log(`   - ${e.breakType} ${e.label} @ ${e.when}`));

    // Optional: probe functions at "now"
    const probe = await pool.query(
      `SELECT 
         is_break_available_soon($1, 'Morning', NOW() AT TIME ZONE 'Asia/Manila') AS morning_soon,
         is_break_available_soon($1, 'Lunch', NOW() AT TIME ZONE 'Asia/Manila') AS lunch_soon,
         is_break_available_soon($1, 'Afternoon', NOW() AT TIME ZONE 'Asia/Manila') AS afternoon_soon,
         (CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_break_available_now') THEN is_break_available_now($1, 'Afternoon', NOW() AT TIME ZONE 'Asia/Manila') ELSE false END) AS afternoon_now,
         (CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_break_window_ending_soon') THEN is_break_window_ending_soon($1, 'Afternoon', NOW() AT TIME ZONE 'Asia/Manila') ELSE false END) AS ending_soon
       `,
      [userId]
    );
    console.log('\n🔬 Probe now():', probe.rows[0]);

    console.log('\n🎯 Summary:');
    console.log(`   • Shift type: ${isNightShift ? 'Night' : 'Day'}`);
    console.log(`   • Expected notifications: ${expected.length}`);
    console.log(`   • Matched within tolerance: ${matched.length}`);
    console.log(`   • Missing: ${unmatched.length}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
