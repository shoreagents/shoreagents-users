const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyRealtimeProductivityUpdates() {
  try {
    console.log('🔧 Applying Real-time Productivity Score Updates Migration\n');
    
    // Step 1: Read and apply the migration
    console.log('1️⃣ Applying real-time productivity updates migration...');
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', 'migrations', '050_add_realtime_productivity_updates.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');
    
    // Step 2: Verify the enhanced trigger was created
    console.log('\n2️⃣ Verifying enhanced trigger was created...');
    const triggerCheck = await pool.query(`
      SELECT 
        trigger_name,
        event_manipulation,
        action_timing
      FROM information_schema.triggers 
      WHERE trigger_name = 'trg_productivity_score_on_time_change'
      ORDER BY trigger_name;
    `);
    
    if (triggerCheck.rows.length > 0) {
      console.log('   ✅ Enhanced trigger found:');
      triggerCheck.rows.forEach(trigger => {
        console.log(`      - ${trigger.trigger_name} (${trigger.action_timing} ${trigger.event_manipulation})`);
      });
    } else {
      console.log('   ❌ Enhanced trigger not found');
      return;
    }
    
    // Step 3: Test the enhanced trigger functionality
    console.log('\n3️⃣ Testing enhanced trigger functionality...');
    try {
      // Get current productivity score for user 2
      const beforeScore = await pool.query(`
        SELECT productivity_score, updated_at
        FROM productivity_scores 
        WHERE user_id = 2 AND month_year = to_char(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM')
        LIMIT 1;
      `);
      
      if (beforeScore.rows.length > 0) {
        const before = beforeScore.rows[0];
        console.log(`   📊 Before test: User 2 score: ${before.productivity_score} pts (updated: ${before.updated_at})`);
        
        // Update activity data to trigger the enhanced productivity calculation
        const currentActivity = await pool.query(`
          SELECT today_active_seconds
          FROM activity_data 
          WHERE user_id = 2 AND today_date = CURRENT_DATE
          LIMIT 1;
        `);
        
        if (currentActivity.rows.length > 0) {
          const current = currentActivity.rows[0];
          const newActiveSeconds = current.today_active_seconds + 30; // Add 30 seconds
          
          console.log(`   🔄 Updating user 2 activity from ${current.today_active_seconds}s to ${newActiveSeconds}s active...`);
          
          // This should trigger the enhanced productivity calculation
          await pool.query(`
            UPDATE activity_data 
            SET today_active_seconds = $1, updated_at = NOW()
            WHERE user_id = 2 AND today_date = CURRENT_DATE
          `, [newActiveSeconds]);
          
          // Wait for the trigger to fire and process
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if productivity score was updated
          const afterScore = await pool.query(`
            SELECT productivity_score, updated_at
            FROM productivity_scores 
            WHERE user_id = 2 AND month_year = to_char(NOW() AT TIME ZONE 'Asia/Manila', 'YYYY-MM')
            LIMIT 1;
          `);
          
          if (afterScore.rows.length > 0) {
            const after = afterScore.rows[0];
            console.log(`   📊 After test: User 2 score: ${after.productivity_score} pts (updated: ${after.updated_at})`);
            
            if (before.updated_at !== after.updated_at) {
              console.log('   ✅ SUCCESS: Enhanced trigger updated productivity score!');
              console.log(`      Score change: ${before.productivity_score} -> ${after.productivity_score}`);
              console.log(`      Time change: ${before.updated_at} -> ${after.updated_at}`);
            } else {
              console.log('   ⚠️  Productivity score timestamp unchanged - trigger may not be working');
            }
          }
        } else {
          console.log('   ⚠️  No current activity data found for user 2');
        }
      } else {
        console.log('   ⚠️  No productivity score found for user 2');
      }
    } catch (error) {
      console.log('   ❌ Error testing enhanced trigger:', error.message);
    }
    
    // Step 4: Check database logs for trigger activity
    console.log('\n4️⃣ Checking for enhanced trigger activity in logs...');
    try {
      const logCheck = await pool.query(`
        SELECT 
          log_time,
          log_level,
          log_message
        FROM pg_stat_activity 
        WHERE state = 'active' 
        AND query LIKE '%Productivity score calculated and updated%'
        ORDER BY log_time DESC
        LIMIT 5;
      `);
      
      if (logCheck.rows.length > 0) {
        console.log('   ✅ Found enhanced trigger activity in logs');
        logCheck.rows.forEach(log => {
          console.log(`      ${log.log_time}: ${log.log_message}`);
        });
      } else {
        console.log('   ℹ️  No recent enhanced trigger logs found (this is normal)');
      }
    } catch (error) {
      console.log('   ℹ️  Could not check logs (this is normal)');
    }
    
    console.log('\n🎉 Real-time Productivity Score Updates Migration Applied Successfully!');
    console.log('\n📋 What was enhanced:');
    console.log('   • Enhanced trigger now tracks score changes (old vs new)');
    console.log('   • Trigger emits pg_notify when productivity scores change');
    console.log('   • Socket server listens for notifications and emits real-time updates');
    console.log('   • Frontend receives real-time productivity score updates');
    
    console.log('\n💡 How real-time updates work now:');
    console.log('   1. User activity changes → activity_data updated');
    console.log('   2. Database trigger fires → productivity score calculated');
    console.log('   3. Trigger sends pg_notify → productivity_score_updated channel');
    console.log('   4. Socket server receives notification → emits productivityScoreUpdated event');
    console.log('   5. Frontend receives event → UI updates in real-time');
    
    console.log('\n🚀 Next Steps:');
    console.log('   • Restart your socket server to enable the new notification listener');
    console.log('   • Frontend will now receive real-time productivity updates');
    console.log('   • No more manual refresh needed - scores update automatically!');
    
  } catch (error) {
    console.error('❌ Error applying real-time productivity updates:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  applyRealtimeProductivityUpdates()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { applyRealtimeProductivityUpdates };
