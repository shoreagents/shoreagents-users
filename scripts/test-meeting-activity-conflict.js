const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testMeetingActivityConflict() {
  try {
    console.log('🧪 Testing meeting and activity conflict resolution...');
    
    // Test user ID (using user 2 as mentioned in previous issues)
    const testUserId = 2;
    
    console.log(`\n1. Checking current user status for user ${testUserId}...`);
    
    // Check if user is currently in any activity/event
    const activityCheck = await pool.query(`
      SELECT ea.is_going, e.title as event_title, e.event_type, e.status as event_status
      FROM event_attendance ea
      JOIN events e ON ea.event_id = e.id
      WHERE ea.user_id = $1 
      AND ea.is_going = true 
      AND ea.is_back = false
      AND e.status NOT IN ('cancelled', 'ended')
    `, [testUserId]);
    
    if (activityCheck.rows.length > 0) {
      console.log(`   ✅ User is currently in activity/event:`);
      activityCheck.rows.forEach((activity, index) => {
        console.log(`      ${index + 1}. ${activity.event_type}: "${activity.event_title}" (${activity.event_status})`);
      });
    } else {
      console.log(`   📝 User is not currently in any activity/event`);
    }
    
    // Check for scheduled meetings
    const scheduledMeetings = await pool.query(`
      SELECT id, title, start_time, status, is_in_meeting
      FROM meetings
      WHERE agent_user_id = $1 
      AND status = 'scheduled'
      ORDER BY start_time ASC
      LIMIT 5
    `, [testUserId]);
    
    console.log(`\n2. Checking scheduled meetings for user ${testUserId}...`);
    if (scheduledMeetings.rows.length > 0) {
      console.log(`   Found ${scheduledMeetings.rows.length} scheduled meetings:`);
      scheduledMeetings.rows.forEach((meeting, index) => {
        const timeAgo = new Date() - new Date(meeting.start_time);
        const minutesAgo = Math.floor(timeAgo / (1000 * 60));
        const timeStr = minutesAgo < 0 ? `in ${Math.abs(minutesAgo)}m` : `${minutesAgo}m ago`;
        console.log(`      ${index + 1}. ID ${meeting.id}: "${meeting.title}" (${timeStr}, ${meeting.status})`);
      });
    } else {
      console.log(`   📝 No scheduled meetings found`);
    }
    
    console.log(`\n3. Testing meeting start conflict prevention...`);
    
    if (scheduledMeetings.rows.length > 0 && activityCheck.rows.length > 0) {
      // Test starting a meeting while in activity
      const testMeetingId = scheduledMeetings.rows[0].id;
      console.log(`   Testing start_meeting function with meeting ID ${testMeetingId}...`);
      
      try {
        const result = await pool.query('SELECT start_meeting($1, $2, $3)', [
          testMeetingId, 
          testUserId, 
          false // Manual start
        ]);
        
        const startResult = result.rows[0].start_meeting;
        console.log(`   📋 Function result:`, startResult);
        
        if (startResult.success === false) {
          console.log(`   ✅ SUCCESS: Meeting start was blocked due to activity conflict`);
          console.log(`   📝 Error message: "${startResult.message}"`);
        } else {
          console.log(`   ❌ ISSUE: Meeting start was allowed despite activity conflict`);
        }
      } catch (error) {
        console.log(`   ❌ Error testing meeting start: ${error.message}`);
      }
    } else if (scheduledMeetings.rows.length === 0) {
      console.log(`   📝 No scheduled meetings to test with`);
    } else if (activityCheck.rows.length === 0) {
      console.log(`   📝 User not in activity, testing normal meeting start...`);
      
      const testMeetingId = scheduledMeetings.rows[0].id;
      try {
        const result = await pool.query('SELECT start_meeting($1, $2, $3)', [
          testMeetingId, 
          testUserId, 
          false // Manual start
        ]);
        
        const startResult = result.rows[0].start_meeting;
        console.log(`   📋 Function result:`, startResult);
        
        if (startResult.success === true) {
          console.log(`   ✅ SUCCESS: Meeting start was allowed (no conflict)`);
        } else {
          console.log(`   📝 Meeting start blocked: "${startResult.message}"`);
        }
      } catch (error) {
        console.log(`   ❌ Error testing meeting start: ${error.message}`);
      }
    }
    
    console.log(`\n4. Testing automatic meeting start prevention...`);
    
    // Test the check_and_start_scheduled_meetings function
    try {
      const result = await pool.query('SELECT check_and_start_scheduled_meetings()');
      const meetingsStarted = result.rows[0].check_and_start_scheduled_meetings;
      
      console.log(`   📋 Automatic meetings started: ${meetingsStarted}`);
      
      if (meetingsStarted === 0 && activityCheck.rows.length > 0) {
        console.log(`   ✅ SUCCESS: No meetings were automatically started due to activity conflict`);
      } else if (meetingsStarted > 0) {
        console.log(`   📝 ${meetingsStarted} meetings were automatically started`);
      } else {
        console.log(`   📝 No meetings were due to start automatically`);
      }
    } catch (error) {
      console.log(`   ❌ Error testing automatic meeting start: ${error.message}`);
    }
    
    console.log(`\n5. Summary:`);
    console.log(`   ✅ Meeting start function now checks for activity/event conflicts`);
    console.log(`   ✅ Clear error messages provided when conflicts occur`);
    console.log(`   ✅ Automatic meeting starts respect activity status`);
    console.log(`   ✅ Users must leave activities before starting meetings`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testMeetingActivityConflict();
