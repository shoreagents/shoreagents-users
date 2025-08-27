// Apply the team chat soft delete fix
// This script fixes the issue where deleting a conversation only hides it for one user

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyTeamChatSoftDeleteFix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Applying team chat soft delete fix...\n');
    
    // 1. Apply the migration
    console.log('1️⃣ Applying migration 052_fix_team_chat_soft_delete.sql...');
    
    const migrationSQL = `
      -- Fix the get_user_conversations function to properly filter out deleted conversations
      CREATE OR REPLACE FUNCTION get_user_conversations(user_id_param INTEGER)
      RETURNS TABLE (
        conversation_id INTEGER,
        conversation_type VARCHAR(20),
        last_message_content TEXT,
        last_message_at TIMESTAMP,
        unread_count BIGINT,
        other_participant_id INTEGER,
        other_participant_name TEXT,
        other_participant_email TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          tc.id,
          tc.conversation_type,
          tm.content,
          tc.last_message_at,
          COALESCE(unread.unread_count, 0),
          other_user.id,
          TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as other_participant_name,
          other_user.email
        FROM team_conversations tc
        JOIN conversation_participants cp ON tc.id = cp.conversation_id
        JOIN conversation_participants other_cp ON tc.id = other_cp.conversation_id
        JOIN users other_user ON other_cp.user_id = other_user.id
        LEFT JOIN personal_info pi ON other_user.id = pi.user_id
        LEFT JOIN (
          SELECT DISTINCT ON (tm_sub.conversation_id)
            tm_sub.conversation_id,
            tm_sub.content,
            tm_sub.created_at
          FROM team_messages tm_sub
          WHERE tm_sub.is_deleted = FALSE
          ORDER BY tm_sub.conversation_id, tm_sub.created_at DESC
        ) tm ON tc.id = tm.conversation_id
        LEFT JOIN (
          SELECT
            tm2.conversation_id,
            COUNT(*) as unread_count
          FROM team_messages tm2
          LEFT JOIN message_delivery_status mds ON tm2.id = mds.message_id AND mds.user_id = user_id_param
          WHERE tm2.created_at > COALESCE(mds.read_at, '1970-01-01'::timestamp)
            AND tm2.sender_id != user_id_param
            AND tm2.is_deleted = FALSE
            AND (mds.deleted_at IS NULL OR mds.deleted_at < tm2.created_at)
          GROUP BY tm2.conversation_id
        ) unread ON tc.id = unread.conversation_id
        WHERE cp.user_id = user_id_param
          AND other_cp.user_id != user_id_param
          AND cp.is_active = TRUE -- Only show conversations where current user is still active
          AND cp.left_at IS NULL -- Don't show conversations where user has left
        ORDER BY tc.last_message_at DESC NULLS LAST;
      END;
      $$ LANGUAGE plpgsql;
    `;
    
    await client.query(migrationSQL);
    console.log('   ✅ Updated get_user_conversations function');
    
    // 2. Test the function
    console.log('\n2️⃣ Testing the updated function...');
    
    // Check if there are any users to test with
    const userCheck = await client.query('SELECT id, email FROM users LIMIT 2');
    
    if (userCheck.rows.length >= 2) {
      const userId = userCheck.rows[0].id;
      console.log(`   Testing with user ID: ${userId} (${userCheck.rows[0].email})`);
      
      const result = await client.query('SELECT * FROM get_user_conversations($1)', [userId]);
      console.log(`   ✅ Function executed successfully, returned ${result.rows.length} conversations`);
      
      if (result.rows.length > 0) {
        console.log('   Sample conversation data:');
        result.rows.slice(0, 2).forEach((row, index) => {
          console.log(`     ${index + 1}. ID: ${row.conversation_id}, Type: ${row.conversation_type}, Other User: ${row.other_participant_email}`);
        });
      }
    } else {
      console.log('   ⚠️ No users found to test with');
    }
    
    // 3. Check current conversation participants status
    console.log('\n3️⃣ Checking current conversation participants status...');
    
    const participantsCheck = await client.query(`
      SELECT 
        cp.conversation_id,
        cp.user_id,
        cp.is_active,
        cp.left_at,
        u.email
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      ORDER BY cp.conversation_id, cp.user_id
    `);
    
    console.log(`   Found ${participantsCheck.rows.length} conversation participants:`);
    participantsCheck.rows.forEach(row => {
      const status = row.is_active ? 'Active' : 'Inactive';
      const leftInfo = row.left_at ? ` (Left: ${row.left_at})` : '';
      console.log(`     Conversation ${row.conversation_id}: User ${row.email} - ${status}${leftInfo}`);
    });
    
    // 4. Check message delivery status
    console.log('\n4️⃣ Checking message delivery status...');
    
    const messageStatusCheck = await client.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_messages,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_messages
      FROM message_delivery_status
    `);
    
    const status = messageStatusCheck.rows[0];
    console.log(`   Message delivery status:`);
    console.log(`     Total: ${status.total_messages}`);
    console.log(`     Deleted: ${status.deleted_messages}`);
    console.log(`     Active: ${status.active_messages}`);
    
    console.log('\n✅ Team chat soft delete fix applied successfully!');
    console.log('\n📋 What was fixed:');
    console.log('   • Updated get_user_conversations function to properly filter out deleted conversations');
    console.log('   • Added proper checks for is_active = TRUE and left_at IS NULL');
    console.log('   • Now when a user deletes a conversation, it will be hidden from their view');
    console.log('   • The conversation remains visible to other participants until they also delete it');
    
  } catch (error) {
    console.error('❌ Error applying team chat soft delete fix:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
if (require.main === module) {
  applyTeamChatSoftDeleteFix()
    .then(() => {
      console.log('\n🎉 Team chat soft delete fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Team chat soft delete fix failed:', error.message);
      process.exit(1);
    });
}

module.exports = { applyTeamChatSoftDeleteFix };
