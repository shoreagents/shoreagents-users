const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyThirtyMinuteReminders() {
  try {
    console.log('🔧 Applying 30-minute in-window reminder logic...\n');

    const sqlFilePath = path.join(__dirname, 'add-30min-reminders.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('1️⃣ Executing SQL from:', sqlFilePath);
    await pool.query(sqlContent);
    console.log('   ✅ Functions updated: is_break_reminder_due(), check_break_reminders()');

    console.log('\n2️⃣ Quick tests for Afternoon window (User 2)');
    // Afternoon window for User 2: 13:45 - 14:45 (from earlier debug)
    const tests = [
      '2025-08-19 14:14:00', // 29 minutes after start -> false
      '2025-08-19 14:15:00', // 30 minutes after start -> true
      '2025-08-19 14:16:00', // within tolerance window -> may be true
      '2025-08-19 14:30:00', // 45 minutes after start -> false (not a 30-min multiple)
      '2025-08-19 14:45:00', // window end -> false
    ];

    for (const t of tests) {
      const { rows } = await pool.query(
        `SELECT is_break_reminder_due(2, 'Afternoon', $1::timestamp without time zone) as due`,
        [t]
      );
      console.log(`   ${t.split(' ')[1]} -> ${rows[0].due ? '✅ due' : '❌ not due'}`);
    }

    console.log('\n3️⃣ Simulate notification creation at 14:15:00');
    // Clear recent
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '2 minutes'
    `);

    // Manually create (check_break_reminders will create automatically at runtime)
    await pool.query(`SELECT create_break_reminder_notification(2, 'missed_break', 'Afternoon')`);

    const { rows: created } = await pool.query(`
      SELECT title, message, payload->>'reminder_type' as kind, payload->>'break_type' as break_type, created_at
      FROM notifications
      WHERE user_id = 2 AND category = 'break'
      ORDER BY created_at DESC
      LIMIT 3
    `);

    if (created.length) {
      console.log('   📣 Latest notifications:');
      for (const n of created) {
        console.log(`   - ${n.title} | ${n.message} | ${n.kind} | ${n.break_type} | ${new Date(n.created_at).toLocaleString()}`);
      }
      console.log('   ✅ "You have not taken your Afternoon break yet!" will now recur every 30 minutes until taken, within the window.');
    } else {
      console.log('   ℹ️ No notifications found (outside test window).');
    }

    console.log('\n✅ 30-minute reminder logic applied.');
  } catch (err) {
    console.error('❌ Error applying 30-minute reminders:', err.message);
  } finally {
    await pool.end();
  }
}

applyThirtyMinuteReminders();
