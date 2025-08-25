const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixProductivityTriggerTypeError() {
  try {
    console.log('🔧 Fixing Productivity Trigger Type Error\n');
    
    // Step 1: Drop the existing problematic trigger
    console.log('1️⃣ Dropping existing problematic trigger...');
    await pool.query('DROP TRIGGER IF EXISTS trg_productivity_score_on_time_change ON activity_data;');
    console.log('   ✅ Existing trigger dropped');
    
    // Step 2: Drop the existing function
    console.log('\n2️⃣ Dropping existing function...');
    await pool.query('DROP FUNCTION IF EXISTS update_productivity_score_on_time_change();');
    console.log('   ✅ Existing function dropped');
    
    // Step 3: Create the fixed function with proper type handling
    console.log('\n3️⃣ Creating fixed function with proper type handling...');
    const fixedFunctionSQL = `
      CREATE OR REPLACE FUNCTION update_productivity_score_on_time_change()
      RETURNS TRIGGER AS $$
      DECLARE
          affected_month_year VARCHAR(7);
          time_changed BOOLEAN;
      BEGIN
          -- Only proceed if this is an UPDATE operation with time tracking changes
          IF TG_OP = 'UPDATE' THEN
              -- Check if time tracking values actually changed significantly (more than 1 second)
              time_changed := (
                  ABS(COALESCE(NEW.today_active_seconds, 0) - COALESCE(OLD.today_active_seconds, 0)) > 1 OR
                  ABS(COALESCE(NEW.today_inactive_seconds, 0) - COALESCE(OLD.today_inactive_seconds, 0)) > 1
              );
              
              -- Only update if there was a meaningful time change
              IF NOT time_changed THEN
                  RETURN NEW;
              END IF;
          END IF;
          
          -- Get the month_year for the changed record
          SELECT get_month_year(NEW.today_date) INTO affected_month_year;
          
          -- Only update productivity scores for recent months (within 3 months)
          -- Convert month_year string to date for proper comparison
          IF affected_month_year >= to_char((NOW() AT TIME ZONE 'Asia/Manila')::date - INTERVAL '3 months', 'YYYY-MM') THEN
              -- Use a deferred approach to avoid blocking the main operation
              -- Schedule the productivity update for later
              PERFORM pg_notify(
                  'productivity_update_needed',
                  json_build_object(
                      'user_id', NEW.user_id,
                      'month_year', affected_month_year,
                      'timestamp', NOW()
                  )::text
              );
              
              -- Log the notification (optional, for debugging)
              RAISE LOG 'Scheduled productivity score update for month % (user_id: %)', 
                        affected_month_year, NEW.user_id;
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await pool.query(fixedFunctionSQL);
    console.log('   ✅ Fixed function created');
    
    // Step 4: Create the trigger
    console.log('\n4️⃣ Creating fixed trigger...');
    await pool.query(`
      CREATE TRIGGER trg_productivity_score_on_time_change
          AFTER INSERT OR UPDATE ON activity_data
          FOR EACH ROW
          EXECUTE FUNCTION update_productivity_score_on_time_change();
    `);
    console.log('   ✅ Fixed trigger created');
    
    // Step 5: Verify the trigger was created
    console.log('\n5️⃣ Verifying trigger was created...');
    const triggerCheck = await pool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers 
      WHERE trigger_name = 'trg_productivity_score_on_time_change'
      ORDER BY trigger_name;
    `);
    
    if (triggerCheck.rows.length === 1) {
      console.log('   ✅ New trigger created successfully:');
      triggerCheck.rows.forEach(trigger => {
        console.log(`      - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
      });
    } else {
      console.log('   ⚠️  New trigger may not have been created properly');
      console.log('      Expected: 1, Found:', triggerCheck.rows.length);
    }
    
    // Step 6: Test the function with a simple query
    console.log('\n6️⃣ Testing the fixed function...');
    try {
      const testResult = await pool.query('SELECT update_productivity_score_on_time_change() IS NOT NULL as function_exists;');
      console.log('   ✅ Function test successful:', testResult.rows[0].function_exists);
    } catch (error) {
      console.log('   ⚠️  Function test failed:', error.message);
    }
    
    console.log('\n🎉 Productivity Trigger Type Error Fixed Successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   • Dropped problematic trigger that was causing type comparison errors');
    console.log('   • Fixed type mismatch between VARCHAR and timestamp in month comparison');
    console.log('   • Recreated trigger with proper type handling using to_char()');
    console.log('   • Maintained the same functionality but with correct data types');
    
    console.log('\n💡 The fix:');
    console.log('   • Changed: affected_month_year >= (NOW() AT TIME ZONE \'Asia/Manila\')::date - INTERVAL \'3 months\'');
    console.log('   • To: affected_month_year >= to_char((NOW() AT TIME ZONE \'Asia/Manila\')::date - INTERVAL \'3 months\', \'YYYY-MM\')');
    console.log('   • This ensures both sides of the comparison are VARCHAR strings');
    
  } catch (error) {
    console.error('❌ Error fixing productivity trigger type error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix
if (require.main === module) {
  fixProductivityTriggerTypeError()
    .then(() => {
      console.log('\n✅ Fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixProductivityTriggerTypeError };
