require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixChatConversations() {
  try {
    console.log('🔧 Fixing Chat Conversations...\n');

    // 1. Check current state
    console.log('1️⃣ Current Conversations:');
    const conversations = await pool.query('SELECT * FROM team_conversations ORDER BY id');
    console.table(conversations.rows);

    console.log('\n2️⃣ Current Participants:');
    const participants = await pool.query('SELECT * FROM conversation_participants ORDER BY conversation_id, user_id');
    console.table(participants.rows);

    // 2. Find duplicate conversations
    console.log('\n3️⃣ Finding Duplicate Conversations:');
    const duplicates = await pool.query(`
      SELECT 
        tc.metadata->>'participants' as participants,
        COUNT(*) as count,
        array_agg(tc.id) as conversation_ids
      FROM team_conversations tc
      WHERE tc.conversation_type = 'direct'
      GROUP BY tc.metadata->>'participants'
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      console.log('⚠️  Found duplicate conversations:');
      console.table(duplicates.rows);
      
      // 3. Clean up duplicates (keep the first one, delete others)
      for (const dup of duplicates.rows) {
        const convIds = dup.conversation_ids;
        const keepId = Math.min(...convIds);
        const deleteIds = convIds.filter(id => id !== keepId);
        
        console.log(`\n   Cleaning up participants [${dup.participants}]:`);
        console.log(`   Keeping conversation ${keepId}, deleting ${deleteIds.join(', ')}`);
        
        for (const deleteId of deleteIds) {
          // Delete messages first (due to foreign key constraints)
          await pool.query('DELETE FROM team_messages WHERE conversation_id = $1', [deleteId]);
          // Delete delivery status
          await pool.query('DELETE FROM message_delivery_status WHERE message_id IN (SELECT id FROM team_messages WHERE conversation_id = $1)', [deleteId]);
          // Delete participants
          await pool.query('DELETE FROM conversation_participants WHERE conversation_id = $1', [deleteId]);
          // Delete conversation
          await pool.query('DELETE FROM team_conversations WHERE id = $1', [deleteId]);
          console.log(`   ✅ Deleted conversation ${deleteId}`);
        }
      }
    } else {
      console.log('✅ No duplicate conversations found');
    }

    // 4. Check if conversation between users 2 and 4 exists
    console.log('\n4️⃣ Checking Conversation Between Users 2 and 4:');
    const conv24 = await pool.query(`
      SELECT tc.id, tc.conversation_type, tc.metadata
      FROM team_conversations tc
      JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
      WHERE tc.conversation_type = 'direct'
        AND cp1.user_id = 2
        AND cp2.user_id = 4
        AND cp1.user_id != cp2.user_id
    `);

    if (conv24.rows.length === 0) {
      console.log('❌ No conversation found between users 2 and 4');
      console.log('   Creating new conversation...');
      
      // Create conversation between users 2 and 4
      const result = await pool.query(
        'SELECT create_direct_conversation($1, $2) as conversation_id',
        [2, 4]
      );
      
      const newConvId = result.rows[0].conversation_id;
      console.log(`   ✅ Created conversation ${newConvId} between users 2 and 4`);
    } else {
      console.log(`✅ Found existing conversation ${conv24.rows[0].id} between users 2 and 4`);
    }

    // 5. Final state check
    console.log('\n5️⃣ Final State:');
    const finalConversations = await pool.query('SELECT * FROM team_conversations ORDER BY id');
    console.table(finalConversations.rows);

    const finalParticipants = await pool.query('SELECT * FROM conversation_participants ORDER BY conversation_id, user_id');
    console.table(finalParticipants.rows);

    console.log('\n🎉 Chat conversations fixed!');
    console.log('\n📝 Summary of fixes:');
    console.log('   • Removed duplicate conversations');
    console.log('   • Ensured conversation exists between users 2 and 4');
    console.log('   • Cleaned up database structure');

  } catch (error) {
    console.error('❌ Error fixing chat conversations:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix function
fixChatConversations();
