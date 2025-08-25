require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function debugMessageRouting() {
  try {
    console.log('🔍 Debugging Message Routing Issue...\n');

    // 1. Check all conversations and their participants
    console.log('1️⃣ Conversations and Participants:');
    const conversations = await pool.query(`
      SELECT 
        tc.id as conversation_id,
        tc.conversation_type,
        tc.metadata,
        array_agg(cp.user_id ORDER BY cp.user_id) as participants
      FROM team_conversations tc
      JOIN conversation_participants cp ON tc.id = cp.conversation_id
      GROUP BY tc.id, tc.conversation_type, tc.metadata
      ORDER BY tc.id
    `);
    
    conversations.rows.forEach(conv => {
      console.log(`   Conversation ${conv.conversation_id}: Users [${conv.participants.join(', ')}] - ${conv.metadata?.participants ? `DB: [${conv.metadata.participants.join(', ')}]` : 'No metadata'}`);
    });

    // 2. Check all messages and their conversation routing
    console.log('\n2️⃣ Messages and Their Conversations:');
    const messages = await pool.query(`
      SELECT 
        tm.id,
        tm.conversation_id,
        tm.sender_id,
        tm.content,
        tm.created_at,
        tc.metadata->>'participants' as conversation_participants
      FROM team_messages tm
      JOIN team_conversations tc ON tm.conversation_id = tc.id
      ORDER BY tm.created_at
    `);
    
    messages.rows.forEach(msg => {
      console.log(`   Message ${msg.id}: "${msg.content}" from User ${msg.sender_id} → Conversation ${msg.conversation_id} (participants: ${msg.conversation_participants})`);
    });

    // 3. Check specific user conversations
    console.log('\n3️⃣ User-Specific Conversations:');
    
    // Check User 2's conversations
    console.log('\n   User 2 Conversations:');
    const user2Convs = await pool.query(`
      SELECT DISTINCT tc.id, tc.metadata->>'participants' as participants
      FROM team_conversations tc
      JOIN conversation_participants cp ON tc.id = cp.conversation_id
      WHERE cp.user_id = 2
      ORDER BY tc.id
    `);
    
    user2Convs.rows.forEach(conv => {
      console.log(`     Conversation ${conv.id}: [${conv.participants}]`);
    });

    // Check User 4's conversations
    console.log('\n   User 4 Conversations:');
    const user4Convs = await pool.query(`
      SELECT DISTINCT tc.id, tc.metadata->>'participants' as participants
      FROM team_conversations tc
      JOIN conversation_participants cp ON tc.id = cp.conversation_id
      WHERE cp.user_id = 4
      ORDER BY tc.id
    `);
    
    user4Convs.rows.forEach(conv => {
      console.log(`     Conversation ${conv.id}: [${conv.participants}]`);
    });

    // 4. Check which conversation should be used for User 2 ↔ User 4
    console.log('\n4️⃣ Expected Conversation Routing:');
    const expectedConv = await pool.query(`
      SELECT tc.id, tc.metadata->>'participants' as participants
      FROM team_conversations tc
      JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
      JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
      WHERE tc.conversation_type = 'direct'
        AND cp1.user_id = 2
        AND cp2.user_id = 4
        AND cp1.user_id != cp2.user_id
    `);
    
    if (expectedConv.rows.length > 0) {
      console.log(`   ✅ Expected conversation between User 2 and User 4: Conversation ${expectedConv.rows[0].id}`);
      console.log(`   Participants: [${expectedConv.rows[0].participants}]`);
    } else {
      console.log('   ❌ No conversation found between User 2 and User 4');
    }

    // 5. Check if messages are in the wrong conversation
    console.log('\n5️⃣ Message Routing Analysis:');
    const wrongMessages = await pool.query(`
      SELECT 
        tm.id,
        tm.conversation_id,
        tm.sender_id,
        tm.content,
        CASE 
          WHEN tm.sender_id = 2 AND tm.conversation_id != ${expectedConv.rows[0]?.id || 'NULL'} THEN 'WRONG CONVERSATION'
          WHEN tm.sender_id = 4 AND tm.conversation_id != ${expectedConv.rows[0]?.id || 'NULL'} THEN 'WRONG CONVERSATION'
          ELSE 'CORRECT'
        END as routing_status
      FROM team_messages tm
      WHERE tm.sender_id IN (2, 4)
      ORDER BY tm.created_at
    `);
    
    wrongMessages.rows.forEach(msg => {
      const status = msg.routing_status === 'WRONG CONVERSATION' ? '❌' : '✅';
      console.log(`   ${status} Message ${msg.id}: User ${msg.sender_id} → Conversation ${msg.conversation_id} - ${msg.routing_status}`);
    });

  } catch (error) {
    console.error('❌ Error debugging message routing:', error);
  } finally {
    await pool.end();
  }
}

// Run the debug function
debugMessageRouting();
