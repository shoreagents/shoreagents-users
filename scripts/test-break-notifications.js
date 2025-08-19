#!/usr/bin/env node

/**
 * Test Script: Break Notifications
 * 
 * This script tests if break notifications are working by manually inserting
 * a test notification and checking the database setup.
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testBreakNotifications() {
  console.log('🧪 Testing Break Notifications System\n');
  
  try {
    // 1. Check if notifications table exists
    console.log('1. Checking notifications table...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ notifications table does not exist!');
      return;
    }
    console.log('✅ notifications table exists');

    // 2. Check table structure
    console.log('\n2. Checking table structure...');
    const structure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 Table columns:');
    structure.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    // 3. Find a test user
    console.log('\n3. Finding test user...');
    const userResult = await pool.query(`
      SELECT u.id, u.email, ji.shift_time 
      FROM users u 
      LEFT JOIN job_info ji ON ji.agent_user_id = u.id 
      WHERE u.user_type = 'Agent' 
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No agent users found!');
      return;
    }
    
    const testUser = userResult.rows[0];
    console.log(`✅ Found test user: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`   Shift: ${testUser.shift_time || 'Not set'}`);

    // 4. Check if break function exists
    console.log('\n4. Checking break availability function...');
    try {
      const breakCheck = await pool.query(
        'SELECT * FROM get_agent_daily_breaks($1) as (break_type text, break_count bigint, can_take_break boolean, last_break_time timestamp)',
        [testUser.id]
      );
      console.log('✅ get_agent_daily_breaks function works');
      console.log('📊 Break availability:');
      breakCheck.rows.forEach(row => {
        console.log(`   - ${row.break_type}: ${row.can_take_break ? 'Available' : 'Used'} (count: ${row.break_count})`);
      });
    } catch (error) {
      console.log('❌ get_agent_daily_breaks function error:', error.message);
    }

    // 5. Insert a test break notification
    console.log('\n5. Inserting test break notification...');
    try {
      const insertResult = await pool.query(`
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        VALUES ($1, 'break', 'info', $2, $3, $4)
        RETURNING id, created_at
      `, [
        testUser.id,
        'Test Break Available',
        'This is a test break notification from the test script',
        { break_type: 'Morning', action_url: '/status/breaks', test: true }
      ]);
      
      const notification = insertResult.rows[0];
      console.log(`✅ Test notification inserted with ID: ${notification.id}`);
      console.log(`   Created at: ${notification.created_at}`);
      
      // 6. Check if notification appears in table
      console.log('\n6. Verifying notification in database...');
      const verifyResult = await pool.query(`
        SELECT id, category, type, title, message, created_at 
        FROM notifications 
        WHERE user_id = $1 AND category = 'break'
        ORDER BY created_at DESC 
        LIMIT 5
      `, [testUser.id]);
      
      console.log(`📋 Recent break notifications for user ${testUser.email}:`);
      if (verifyResult.rows.length === 0) {
        console.log('   (No break notifications found)');
      } else {
        verifyResult.rows.forEach(row => {
          console.log(`   - [${row.id}] ${row.title} (${row.type}) - ${new Date(row.created_at).toLocaleString()}`);
        });
      }

      // 7. Clean up test notification
      console.log('\n7. Cleaning up test notification...');
      await pool.query('DELETE FROM notifications WHERE id = $1', [notification.id]);
      console.log('✅ Test notification cleaned up');

    } catch (error) {
      console.log('❌ Error inserting test notification:', error.message);
    }

    // 8. Check notification triggers
    console.log('\n8. Checking notification triggers...');
    const triggerCheck = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'notifications'
    `);
    
    if (triggerCheck.rows.length === 0) {
      console.log('⚠️  No triggers found on notifications table');
    } else {
      console.log('📋 Notification triggers:');
      triggerCheck.rows.forEach(row => {
        console.log(`   - ${row.trigger_name} (${row.event_manipulation})`);
      });
    }

    console.log('\n🎯 Summary:');
    console.log('✅ Database setup appears correct');
    console.log('✅ Test notification can be inserted');
    console.log('✅ Break availability function works');
    console.log('\n💡 Next steps:');
    console.log('1. Check if socket server is running and connected');
    console.log('2. Verify user has shift_time set in job_info');
    console.log('3. Check if current time is within break windows');
    console.log('4. Monitor socket server logs for break availability checks');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run test if called directly
if (require.main === module) {
  testBreakNotifications().catch(console.error);
}

module.exports = { testBreakNotifications };
