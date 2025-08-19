#!/usr/bin/env node

/**
 * Script to manually trigger a break notification for testing
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function triggerBreakNotification() {
  console.log('🔔 Manually triggering break notification...\n');
  
  try {
    // Find a test user
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
    console.log(`📧 Using user: ${testUser.email} (ID: ${testUser.id})`);
    console.log(`⏰ Shift: ${testUser.shift_time || 'Not set'}`);
    
    // Insert a break notification
    const notificationResult = await pool.query(`
      INSERT INTO notifications (user_id, category, type, title, message, payload)
      VALUES ($1, 'break', 'info', $2, $3, $4)
      RETURNING id, created_at
    `, [
      testUser.id,
      'Morning Break Available',
      'Your morning break window is now open! Take a 15-minute break.',
      { 
        break_type: 'Morning', 
        action_url: '/status/breaks',
        duration: 15,
        window_start: new Date().toISOString(),
        test: true
      }
    ]);
    
    const notification = notificationResult.rows[0];
    console.log(`✅ Break notification created:`);
    console.log(`   ID: ${notification.id}`);
    console.log(`   Created: ${notification.created_at}`);
    console.log(`   User: ${testUser.email}`);
    
    // Check if the notification trigger fired
    console.log('\n🔍 Checking if notification appears in recent notifications...');
    
    // Wait a moment for trigger to fire
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const recentResult = await pool.query(`
      SELECT id, category, type, title, message, created_at, is_read
      FROM notifications 
      WHERE user_id = $1 AND category = 'break'
      ORDER BY created_at DESC 
      LIMIT 3
    `, [testUser.id]);
    
    console.log(`📋 Recent break notifications:`);
    recentResult.rows.forEach(row => {
      const isNew = row.id === notification.id;
      console.log(`   ${isNew ? '🆕' : '📄'} [${row.id}] ${row.title} - ${new Date(row.created_at).toLocaleString()} ${row.is_read ? '(read)' : '(unread)'}`);
    });
    
    console.log('\n💡 Next steps to test:');
    console.log('1. Check if socket server is running on port 3001');
    console.log('2. Open the app and check notification bell');
    console.log('3. Go to /status/breaks page');
    console.log('4. Check browser console for socket connection logs');
    
    console.log('\n🧪 To test socket connection:');
    console.log('- Open browser dev tools');
    console.log('- Look for "Connected to break notification socket" in console');
    console.log('- Look for "db-notification" events in Network tab');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

triggerBreakNotification();
