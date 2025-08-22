const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runSqlDebug() {
  try {
    console.log('🔍 Running SQL debug script...\n');
    
    const sqlScript = `
    DO $$
    DECLARE
        p_agent_user_id INTEGER := 2;
        p_break_type break_type_enum := 'Lunch';
        p_check_time TIMESTAMP WITHOUT TIME ZONE := '2025-08-22 10:30:00';
        
        shift_time TEXT;
        break_windows RECORD;
        current_time_only TIME;
        break_start_time TIME;
        break_end_time TIME;
        minutes_since_start INTEGER;
        break_already_taken BOOLEAN;
        last_notification_time TIMESTAMP;
        minutes_since_last_notification INTEGER;
        remainder INTEGER;
        at_interval BOOLEAN;
    BEGIN
        RAISE NOTICE '=== DEBUGGING is_break_reminder_due ===';
        RAISE NOTICE 'User ID: %, Break Type: %, Check Time: %', p_agent_user_id, p_break_type, p_check_time;
        
        -- 1. Check agent shift information
        RAISE NOTICE '1. Checking agent shift information...';
        SELECT ji.shift_time INTO shift_time 
        FROM job_info ji
        WHERE ji.agent_user_id = p_agent_user_id 
        LIMIT 1;
        
        RAISE NOTICE '   Shift time: %', shift_time;
        
        IF shift_time IS NULL THEN
            RAISE NOTICE '   ❌ No shift time found - function would return FALSE';
            RETURN;
        END IF;
        
        -- 2. Check if break was already taken today
        RAISE NOTICE '2. Checking if break was already taken today...';
        SELECT EXISTS(
            SELECT 1 FROM break_sessions
            WHERE agent_user_id = p_agent_user_id
            AND break_type = p_break_type
            AND break_date = CURRENT_DATE
            AND end_time IS NOT NULL
        ) INTO break_already_taken;
        
        RAISE NOTICE '   Break already taken: %', break_already_taken;
        
        IF break_already_taken THEN
            RAISE NOTICE '   ❌ Break already taken - function would return FALSE';
            RETURN;
        END IF;
        
        -- 3. Check break windows
        RAISE NOTICE '3. Checking break windows...';
        SELECT * INTO break_windows FROM calculate_break_windows(p_agent_user_id)
        WHERE break_type = p_break_type LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE NOTICE '   ❌ No break windows found - function would return FALSE';
            RETURN;
        END IF;
        
        RAISE NOTICE '   Break window: % - % to %', break_windows.break_type, break_windows.start_time, break_windows.end_time;
        
        -- 4. Check if we're within the break window
        RAISE NOTICE '4. Checking if current time is within break window...';
        current_time_only := p_check_time::TIME;
        break_start_time := break_windows.start_time;
        break_end_time := break_windows.end_time;
        
        RAISE NOTICE '   Current time (time only): %', current_time_only;
        RAISE NOTICE '   Break start time: %', break_start_time;
        RAISE NOTICE '   Break end time: %', break_end_time;
        
        IF NOT (current_time_only >= break_start_time AND current_time_only <= break_end_time) THEN
            RAISE NOTICE '   ❌ Not within break window - function would return FALSE';
            RETURN;
        END IF;
        
        RAISE NOTICE '   ✅ Within break window';
        
        -- 5. Calculate minutes since break started
        RAISE NOTICE '5. Calculating minutes since break started...';
        minutes_since_start := EXTRACT(EPOCH FROM (current_time_only - break_start_time)) / 60;
        RAISE NOTICE '   Minutes since break started: %', minutes_since_start;
        
        IF minutes_since_start < 30 THEN
            RAISE NOTICE '   ❌ Less than 30 minutes - function would return FALSE';
            RETURN;
        END IF;
        
        RAISE NOTICE '   ✅ At least 30 minutes have passed';
        
        -- 6. Check recent notifications
        RAISE NOTICE '6. Checking recent notifications...';
        SELECT MAX(created_at) INTO last_notification_time
        FROM notifications
        WHERE user_id = p_agent_user_id
        AND category = 'break'
        AND payload->>'reminder_type' = 'missed_break'
        AND payload->>'break_type' = p_break_type::text
        AND created_at < p_check_time
        AND DATE(created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE;
        
        RAISE NOTICE '   Last notification time: %', last_notification_time;
        
        IF last_notification_time IS NOT NULL THEN
            minutes_since_last_notification := EXTRACT(EPOCH FROM (p_check_time - last_notification_time)) / 60;
            RAISE NOTICE '   Minutes since last notification: %', minutes_since_last_notification;
            
            IF minutes_since_last_notification < 25 THEN
                RAISE NOTICE '   ❌ Less than 25 minutes since last notification - function would return FALSE';
                RETURN;
            END IF;
            
            RAISE NOTICE '   ✅ Enough time has passed since last notification';
        ELSE
            RAISE NOTICE '   ✅ No previous notifications found';
        END IF;
        
        -- 7. Check 30-minute interval logic
        RAISE NOTICE '7. Checking 30-minute interval logic...';
        remainder := minutes_since_start % 30;
        at_interval := remainder <= 5 OR remainder >= 25;
        
        RAISE NOTICE '   Minutes since start: %', minutes_since_start;
        RAISE NOTICE '   Minutes since start: %', minutes_since_start;
        RAISE NOTICE '   Remainder when divided by 30: %', remainder;
        RAISE NOTICE '   At 30-minute interval (with 5-min tolerance): %', at_interval;
        
        IF NOT at_interval THEN
            RAISE NOTICE '   ❌ Not at 30-minute interval - function would return FALSE';
            RETURN;
        END IF;
        
        RAISE NOTICE '   ✅ At 30-minute interval';
        
        RAISE NOTICE '=== ALL CHECKS PASSED! Function should return TRUE ===';
    END $$;
    `;
    
    const result = await pool.query(sqlScript);
    console.log('SQL script executed successfully');
    
  } catch (error) {
    console.error('Error running SQL debug script:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the debug
if (require.main === module) {
  runSqlDebug()
    .then(() => {
      console.log('\n🔍 SQL debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ SQL debug failed:', error.message);
      process.exit(1);
    });
}

module.exports = { runSqlDebug };
