require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugChatIssue() {
  try {
    console.log('🔍 Debugging Chat Conversation Issue...\n');

    // 1. Check all conversations
    console.log('📋 All Conversations:');
    const conversations = await pool.query('SELECT * FROM team_conversations ORDER BY id');
    console.table(conversations.rows);

    // 2. Check all participants
    console.log('\n👥 All Conversation Participants:');
    const participants = await pool.query('SELECT * FROM conversation_participants ORDER BY conversation_id, user_id');
    console.table(participants.rows);

    // 3. Check all messages
    console.log('\n💬 All Messages:');
    const messages = await pool.query('SELECT * FROM team_messages ORDER BY conversation_id, created_at');
    console.table(messages.rows);

    // 4. Check specific conversation details
    if (conversations.rows.length > 0) {
      const firstConvId = conversations.rows[0].id;
      console.log(`\n🔍 Details for Conversation ${firstConvId}:`);
      
      const convDetails = await pool.query(`
        SELECT 
          tc.id as conversation_id,
          tc.conversation_type,
          tc.created_at,
          tc.last_message_at,
          cp.user_id,
          tm.id as message_id,
          tm.sender_id,
          tm.content,
          tm.created_at as message_time
        FROM team_conversations tc
        LEFT JOIN conversation_participants cp ON tc.id = cp.conversation_id
        LEFT JOIN team_messages tm ON tc.id = tm.conversation_id
        WHERE tc.id = $1
        ORDER BY tm.created_at
      `, [firstConvId]);
      
      console.table(convDetails.rows);
    }

    // 5. Test conversation creation logic
    console.log('\n🧪 Testing Conversation Creation Logic:');
    const testUsers = [2, 4]; // The users you mentioned
    
    for (let i = 0; i < testUsers.length; i++) {
      for (let j = i + 1; j < testUsers.length; j++) {
        const user1 = testUsers[i];
        const user2 = testUsers[j];
        
        console.log(`\nChecking conversation between user ${user1} and user ${user2}:`);
        
        const existingConv = await pool.query(`
          SELECT tc.id, tc.conversation_type, tc.metadata
          FROM team_conversations tc
          JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
          JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
          WHERE tc.conversation_type = 'direct'
            AND cp1.user_id = $1
            AND cp2.user_id = $2
            AND cp1.user_id != cp2.user_id
        `, [user1, user2]);
        
        if (existingConv.rows.length > 0) {
          console.log(`✅ Found existing conversation: ${existingConv.rows[0].id}`);
          console.log(`   Metadata: ${JSON.stringify(existingConv.rows[0].metadata)}`);
        } else {
          console.log(`❌ No existing conversation found`);
        }
      }
    }

    // 6. Check if there are any duplicate participants
    console.log('\n🔍 Checking for Duplicate Participants:');
    const duplicateCheck = await pool.query(`
      SELECT conversation_id, user_id, COUNT(*) as count
      FROM conversation_participants
      GROUP BY conversation_id, user_id
      HAVING COUNT(*) > 1
      ORDER BY conversation_id, user_id
    `);
    
    if (duplicateCheck.rows.length > 0) {
      console.log('⚠️  Found duplicate participants:');
      console.table(duplicateCheck.rows);
    } else {
      console.log('✅ No duplicate participants found');
    }

  } catch (error) {
    console.error('❌ Error debugging chat issue:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug function
debugChatIssue();
