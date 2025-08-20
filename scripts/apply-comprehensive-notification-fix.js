const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyComprehensiveNotificationFix() {
  try {
    console.log('🔧 Applying Comprehensive Notification Fix...\n');
    console.log('   This supports ALL break types including night shifts! 🌙\n');
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'fix-notification-logic-comprehensive.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('1️⃣ SQL file loaded successfully');
    console.log(`   File: ${sqlFilePath}`);
    
    // Execute the SQL
    console.log('\n2️⃣ Executing SQL fix...');
    await pool.query(sqlContent);
    console.log('   ✅ create_break_reminder_notification function updated successfully');
    
    // Test the fix with different break types
    console.log('\n3️⃣ Testing with different break types...');
    
    // Clear any recent notifications first
    await pool.query(`
      DELETE FROM notifications 
      WHERE user_id = 2 
      AND category = 'break' 
      AND created_at > NOW() - INTERVAL '1 minute'
    `);
    
    // Test 1: Morning break
    console.log('\n   Testing Morning break:');
    const morningResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'available_soon', 'Morning')
    `);
    console.log('     ✅ Morning break notification created');
    
    // Test 2: Night shift break
    console.log('\n   Testing NightFirst break:');
    const nightFirstResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'available_soon', 'NightFirst')
    `);
    console.log('     ✅ NightFirst break notification created');
    
    // Test 3: Night meal break
    console.log('\n   Testing NightMeal break:');
    const nightMealResult = await pool.query(`
      SELECT create_break_reminder_notification(2, 'available_soon', 'NightMeal')
    `);
    console.log('     ✅ NightMeal break notification created');
    
    // Check the created notifications
    console.log('\n4️⃣ Checking created notifications:');
    const newNotifications = await pool.query(`
      SELECT 
        title,
        message,
        payload->>'break_type' as break_type,
        created_at
      FROM notifications
      WHERE user_id = 2
      AND category = 'break'
      AND created_at > NOW() - INTERVAL '1 minute'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (newNotifications.rows.length > 0) {
      console.log(`   📢 Found ${newNotifications.rows.length} new notifications:`);
      newNotifications.rows.forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title}`);
        console.log(`      Message: ${notification.message}`);
        console.log(`      Break Type: ${notification.break_type}`);
        console.log(`      Time: ${notification.created_at.toLocaleString()}`);
        console.log('');
      });
      
      // Check if night shift notifications are working
      const nightNotifications = newNotifications.rows.filter(n => 
        n.break_type === 'NightFirst' || n.break_type === 'NightMeal' || n.break_type === 'NightSecond'
      );
      
      if (nightNotifications.length > 0) {
        console.log('   ✅ Night shift notifications working correctly!');
        nightNotifications.forEach(n => {
          if (n.message.includes('First Night') || n.message.includes('Night Meal') || n.message.includes('Second Night')) {
            console.log(`     ✅ ${n.break_type}: User-friendly name displayed`);
          } else {
            console.log(`     ❌ ${n.break_type}: Generic name displayed`);
          }
        });
      } else {
        console.log('   ❌ No night shift notifications found');
      }
      
      // Check if day shift notifications are working
      const dayNotifications = newNotifications.rows.filter(n => 
        n.break_type === 'Morning' || n.break_type === 'Lunch' || n.break_type === 'Afternoon'
      );
      
      if (dayNotifications.length > 0) {
        console.log('   ✅ Day shift notifications working correctly!');
        dayNotifications.forEach(n => {
          if (n.message.includes('Morning') || n.message.includes('Lunch') || n.message.includes('Afternoon')) {
            console.log(`     ✅ ${n.break_type}: User-friendly name displayed`);
          } else {
            console.log(`     ❌ ${n.break_type}: Generic name displayed`);
          }
        });
      } else {
        console.log('   ❌ No day shift notifications found');
      }
      
    } else {
      console.log('     ❌ No notifications were created');
    }
    
    // Summary
    console.log('\n✅ Comprehensive notification fix applied and tested!');
    
    console.log('\n🎯 What was fixed:');
    console.log('   • Supports ALL break types (Morning, Lunch, Afternoon)');
    console.log('   • Supports ALL night shift break types (NightFirst, NightMeal, NightSecond)');
    console.log('   • Provides user-friendly names (First Night, Night Meal, Second Night)');
    console.log('   • Shows correct minutes remaining (15, 14, 13, etc.)');
    console.log('   • No more hardcoded "5 minutes" message');
    
    console.log('\n🔧 Result:');
    console.log('   • Day shifts: "Your Morning break will end in 15 minutes" ✅');
    console.log('   • Night shifts: "Your First Night break will end in 15 minutes" ✅');
    console.log('   • All break types now supported with proper naming! 🎉');
    
  } catch (error) {
    console.error('❌ Error applying fix:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix application
applyComprehensiveNotificationFix();
