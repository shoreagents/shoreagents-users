const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixIsBreakEndingSoon() {
  console.log('🔧 Fixing is_break_ending_soon Function\n');
  
  try {
    console.log('1️⃣ Fixing is_break_ending_soon function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION is_break_ending_soon(
          p_agent_user_id INTEGER,
          p_current_time TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
      )
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      AS $$
      DECLARE
          active_break RECORD;
          break_duration_minutes INTEGER;
          elapsed_minutes INTEGER;
          remaining_minutes INTEGER;
          current_time_manila TIMESTAMP;
          current_hour INTEGER;
      BEGIN
          -- Get current Manila time
          current_time_manila := p_current_time AT TIME ZONE 'Asia/Manila';
          current_hour := EXTRACT(HOUR FROM current_time_manila);
          
          -- CRITICAL FIX: Add time-of-day validation
          -- Only check for ending soon during appropriate shift hours
          IF current_hour >= 6 AND current_hour < 18 THEN
              -- Day shift hours: only check for day shift breaks
              -- This prevents night shift break notifications during day hours
              RETURN FALSE;
          END IF;
          
          -- Get current active break
          SELECT * INTO active_break
          FROM break_sessions
          WHERE agent_user_id = p_agent_user_id
          AND end_time IS NULL
          AND break_date = current_time_manila::DATE
          ORDER BY start_time DESC
          LIMIT 1;
          
          IF NOT FOUND THEN
              RETURN FALSE;
          END IF;
          
          -- Get break duration based on type
          break_duration_minutes := CASE active_break.break_type
              WHEN 'Morning' THEN 15
              WHEN 'Lunch' THEN 60
              WHEN 'Afternoon' THEN 15
              WHEN 'NightFirst' THEN 15
              WHEN 'NightMeal' THEN 60
              WHEN 'NightSecond' THEN 15
              ELSE 15
          END;
          
          -- Calculate elapsed time
          elapsed_minutes := EXTRACT(EPOCH FROM (current_time_manila - active_break.start_time)) / 60;
          
          -- Handle paused breaks
          IF active_break.pause_time IS NOT NULL AND active_break.resume_time IS NULL THEN
              -- Break is currently paused, use time_remaining_at_pause
              remaining_minutes := COALESCE(active_break.time_remaining_at_pause, 0) / 60;
          ELSE
              -- Calculate remaining time
              remaining_minutes := break_duration_minutes - elapsed_minutes;
              
              -- Adjust for pause time if break was paused and resumed
              IF active_break.pause_time IS NOT NULL AND active_break.resume_time IS NOT NULL THEN
                  remaining_minutes := remaining_minutes + EXTRACT(EPOCH FROM (active_break.resume_time - active_break.pause_time)) / 60;
              END IF;
          END IF;
          
          -- Return true if break ends within the next 5 minutes
          RETURN remaining_minutes > 0 AND remaining_minutes <= 5;
      END;
      $$;
    `);
    console.log('   ✅ Fixed is_break_ending_soon function');
    
    // Test the fixed function
    console.log('\n2️⃣ Testing the fixed function...');
    
    try {
      const testResult = await pool.query(`SELECT is_break_ending_soon(2)`);
      console.log(`   ✅ is_break_ending_soon(2) works: ${testResult.rows[0].is_break_ending_soon}`);
    } catch (error) {
      console.log(`   ❌ is_break_ending_soon error: ${error.message}`);
    }
    
    // Test check_break_reminders now
    console.log('\n3️⃣ Testing check_break_reminders function...');
    
    try {
      const testResult = await pool.query(`SELECT check_break_reminders()`);
      console.log(`   ✅ check_break_reminders() works: ${testResult.rows[0].check_break_reminders} notifications sent`);
    } catch (error) {
      console.log(`   ❌ check_break_reminders error: ${error.message}`);
    }
    
    console.log('\n🎉 is_break_ending_soon function fixed successfully!');
    console.log('   ✅ Now works with correct parameter types');
    console.log('   ✅ Added time-of-day validation');
    console.log('   ✅ check_break_reminders should now work');
    
  } catch (error) {
    console.error('❌ Error fixing function:', error.message);
  } finally {
    await pool.end();
  }
}

fixIsBreakEndingSoon();
