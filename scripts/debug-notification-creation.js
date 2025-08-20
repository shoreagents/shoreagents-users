const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugNotificationCreation() {
  const client = await pool.connect();
  try {
    console.log('🔍 Debugging notification creation...\n');
    
    // 1. Check notifications table structure
    console.log('1️⃣ Checking notifications table structure...');
    const tableStructure = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);
    
    if (tableStructure.rows.length > 0) {
      console.log('   Notifications table columns:');
      tableStructure.rows.forEach((col, index) => {
        console.log(`     ${index + 1}. ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'Nullable' : 'Not Null'}`);
        if (col.column_default) {
          console.log(`        Default: ${col.column_default}`);
        }
      });
    }
    
    // 2. Check if there are any notifications at all
    console.log('\n2️⃣ Checking total notifications count...');
    const totalCount = await client.query('SELECT COUNT(*) as total FROM notifications');
    console.log(`   Total notifications in table: ${totalCount.rows[0].total}`);
    
    // 3. Check recent notifications with broader time range
    console.log('\n3️⃣ Checking recent notifications (last hour)...');
    const recentNotifications = await client.query(`
      SELECT 
        id,
        user_id,
        title,
        message,
        category,
        created_at
      FROM notifications
      WHERE created_at > NOW() - INTERVAL '1 hour'
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    if (recentNotifications.rows.length > 0) {
      console.log('   Recent notifications (last hour):');
      recentNotifications.rows.forEach((notif, index) => {
        console.log(`     ${index + 1}. ID: ${notif.id}, User: ${notif.user_id}, Title: ${notif.title}`);
        console.log(`        Category: ${notif.category}, Time: ${notif.created_at.toLocaleString()}`);
      });
    } else {
      console.log('   No notifications in the last hour');
    }
    
    // 4. Test creating a notification manually
    console.log('\n4️⃣ Testing manual notification creation...');
    
    try {
      const testNotification = await client.query(`
        INSERT INTO notifications (
          user_id, 
          title, 
          message, 
          category, 
          created_at
        ) VALUES (
          2, 
          'Test Notification', 
          'Testing notification creation', 
          'break', 
          NOW()
        ) RETURNING id, created_at
      `);
      
      if (testNotification.rows.length > 0) {
        console.log(`   ✅ Test notification created successfully!`);
        console.log(`      ID: ${testNotification.rows[0].id}`);
        console.log(`      Created: ${testNotification.rows[0].created_at.toLocaleString()}`);
        
        // Clean up test notification
        await client.query('DELETE FROM notifications WHERE id = $1', [testNotification.rows[0].id]);
        console.log('   ✅ Test notification cleaned up');
      }
    } catch (insertError) {
      console.log(`   ❌ Error creating test notification: ${insertError.message}`);
      console.log(`   Error details: ${insertError.detail || 'No additional details'}`);
    }
    
    // 5. Check the create_break_reminder_notification function
    console.log('\n5️⃣ Checking create_break_reminder_notification function...');
    
    try {
      const functionExists = await client.query(`
        SELECT proname, prosrc 
        FROM pg_proc 
        WHERE proname = 'create_break_reminder_notification'
      `);
      
      if (functionExists.rows.length > 0) {
        console.log('   ✅ Function exists');
        console.log('   Function source preview:');
        const source = functionExists.rows[0].prosrc;
        const lines = source.split('\n').slice(0, 10);
        lines.forEach((line, index) => {
          console.log(`      ${index + 1}: ${line}`);
        });
        if (source.split('\n').length > 10) {
          console.log('      ... (truncated)');
        }
      } else {
        console.log('   ❌ Function does not exist');
      }
    } catch (funcError) {
      console.log(`   Error checking function: ${funcError.message}`);
    }
    
    // 6. Test the function directly
    console.log('\n6️⃣ Testing create_break_reminder_notification function...');
    
    try {
      const functionTest = await client.query(`
        SELECT create_break_reminder_notification(2, 'break_available', 'Lunch')
      `);
      console.log(`   ✅ Function executed successfully: ${functionTest.rows[0].create_break_reminder_notification}`);
    } catch (funcTestError) {
      console.log(`   ❌ Function test failed: ${funcTestError.message}`);
      console.log(`   Error details: ${funcTestError.detail || 'No additional details'}`);
    }
    
    // 7. Check for any database errors or constraints
    console.log('\n7️⃣ Checking for database constraints or triggers...');
    
    try {
      const constraints = await client.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'notifications'
      `);
      
      if (constraints.rows.length > 0) {
        console.log('   Found constraints:');
        constraints.rows.forEach((constraint, index) => {
          console.log(`     ${index + 1}. ${constraint.constraint_type}: ${constraint.constraint_name} (${constraint.column_name})`);
        });
      } else {
        console.log('   No constraints found');
      }
    } catch (constraintError) {
      console.log(`   Error checking constraints: ${constraintError.message}`);
    }
    
  } catch (error) {
    console.error('\n❌ Error debugging notification creation:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the debug
debugNotificationCreation();
