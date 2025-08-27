// Test the team chat soft delete functionality
// This script tests if the soft delete is working properly

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTeamChatSoftDelete() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing team chat soft delete functionality...\n');
    
    // 1. Check current conversation participants status
    console.log('1️⃣ Current conversation participants status:');
    
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
    
    participantsCheck.rows.forEach(row => {
      const status = row.is_active ? 'Active' : 'Inactive';
      const leftInfo = row.left_at ? ` (Left: ${row.left_at})` : '';
      console.log(`   Conversation ${row.conversation_id}: User ${row.email} - ${status}${leftInfo}`);
    });
    
    // 2. Test get_user_conversations function for User 2
    console.log('\n2️⃣ Testing get_user_conversations for User 2:');
    
    const user2Conversations = await client.query('SELECT * FROM get_user_conversations(2)');
    console.log(`   User 2 conversations: ${user2Conversations.rows.length}`);
    
    if (user2Conversations.rows.length > 0) {
      user2Conversations.rows.forEach(row => {
        console.log(`     - ID: ${row.conversation_id}, Other User: ${row.other_participant_email}`);
      });
    } else {
      console.log('   ✅ No conversations found - soft delete is working!');
    }
    
    // 3. Test find_conversation API logic for User 2 and User 4
    console.log('\n3️⃣ Testing find_conversation logic for User 2 and User 4:');
    
    const findConversationResult = await client.query(`
      SELECT tc.id, tc.conversation_type, tc.metadata
      FROM team_conversations tc
      JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
      WHERE tc.conversation_type = 'direct'
        AND cp1.user_id = 2
        AND cp2.user_id = 4
        AND cp1.user_id != cp2.user_id
        AND cp1.is_active = TRUE
        AND cp1.left_at IS NULL
    `);
    
    console.log(`   Direct query result: ${findConversationResult.rows.length} conversations found`);
    
    if (findConversationResult.rows.length > 0) {
      findConversationResult.rows.forEach(row => {
        console.log(`     - Conversation ID: ${row.id}`);
      });
    } else {
      console.log('   ✅ No conversations found - API logic is working!');
    }
    
    // 4. Test message access for User 2
    console.log('\n4️⃣ Testing message access for User 2:');
    
    // Check if there are any messages in conversation 7
    const messagesCheck = await client.query(`
      SELECT COUNT(*) as message_count
      FROM team_messages 
      WHERE conversation_id = 7
    `);
    
    console.log(`   Total messages in conversation 7: ${messagesCheck.rows[0].message_count}`);
    
    // Check message delivery status for User 2
    const messageStatusCheck = await client.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_messages,
        COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_messages
      FROM message_delivery_status mds
      JOIN team_messages tm ON mds.message_id = tm.id
      WHERE tm.conversation_id = 7 AND mds.user_id = 2
    `);
    
    const status = messageStatusCheck.rows[0];
    console.log(`   Message status for User 2:`);
    console.log(`     Total: ${status.total_messages}`);
    console.log(`     Deleted: ${status.deleted_messages}`);
    console.log(`     Active: ${status.active_messages}`);
    
    // 5. Summary
    console.log('\n📋 Test Summary:');
    
    if (user2Conversations.rows.length === 0 && findConversationResult.rows.length === 0) {
      console.log('   ✅ SOFT DELETE IS WORKING CORRECTLY!');
      console.log('   ✅ User 2 cannot see the conversation');
      console.log('   ✅ API functions respect soft delete');
    } else {
      console.log('   ❌ SOFT DELETE IS NOT WORKING!');
      console.log('   ❌ User 2 can still see the conversation');
      console.log('   ❌ API functions are not respecting soft delete');
    }
    
    console.log('\n🔍 What to check next:');
    console.log('   1. Refresh the frontend page');
    console.log('   2. Check browser console for any errors');
    console.log('   3. Verify the conversation is no longer visible to User 2');
    
  } catch (error) {
    console.error('❌ Error testing team chat soft delete:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testTeamChatSoftDelete()
    .then(() => {
      console.log('\n🎉 Team chat soft delete test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Team chat soft delete test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testTeamChatSoftDelete };
