require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function updateChatFunctions() {
  try {
    console.log('🔧 Updating Team Chat Functions...\n');

    // 1. Update the create_direct_conversation function
    console.log('1️⃣ Updating create_direct_conversation function...');
    await pool.query(`
      CREATE OR REPLACE FUNCTION create_direct_conversation(user1_id INTEGER, user2_id INTEGER)
      RETURNS INTEGER AS $$
      DECLARE
        conversation_id INTEGER;
        existing_conversation_id INTEGER;
      BEGIN
        -- Check if conversation already exists
        SELECT tc.id INTO existing_conversation_id
        FROM team_conversations tc
        JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
        JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
        WHERE tc.conversation_type = 'direct'
          AND cp1.user_id = user1_id
          AND cp2.user_id = user2_id
          AND cp1.user_id != cp2.user_id;
        
        -- If conversation exists, return it
        IF existing_conversation_id IS NOT NULL THEN
          RETURN existing_conversation_id;
        END IF;
        
        -- Create new conversation
        INSERT INTO team_conversations (conversation_type, metadata)
        VALUES ('direct', jsonb_build_object('participants', ARRAY[user1_id, user2_id]))
        RETURNING id INTO conversation_id;
        
        -- Add both users as participants
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (conversation_id, user1_id), (conversation_id, user2_id);
        
        RETURN conversation_id;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ create_direct_conversation function updated');

    // 2. Update the get_user_conversations function
    console.log('\n2️⃣ Updating get_user_conversations function...');
    await pool.query(`
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
          COALESCE(
            CASE 
              WHEN pi.first_name IS NOT NULL AND pi.last_name IS NOT NULL 
              THEN pi.first_name || ' ' || pi.last_name
              WHEN pi.first_name IS NOT NULL 
              THEN pi.first_name
              WHEN pi.last_name IS NOT NULL 
              THEN pi.last_name
              ELSE 'User ' || other_user.id
            END,
            'User ' || other_user.id
          ) as full_name,
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
          GROUP BY tm2.conversation_id
        ) unread ON tc.id = unread.conversation_id
        WHERE cp.user_id = user_id_param
          AND other_cp.user_id != user_id_param
        ORDER BY tc.last_message_at DESC NULLS LAST;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('   ✅ get_user_conversations function updated');

    // 3. Test the updated functions
    console.log('\n3️⃣ Testing updated functions...');
    
    // Test conversation creation
    console.log('   Testing conversation creation...');
    const testResult = await pool.query('SELECT create_direct_conversation(1, 2) as conversation_id');
    console.log(`   ✅ Test conversation created: ${testResult.rows[0].conversation_id}`);
    
    // Test getting conversations
    console.log('   Testing get_user_conversations...');
    const conversationsResult = await pool.query('SELECT * FROM get_user_conversations(1)');
    console.log(`   ✅ Found ${conversationsResult.rows.length} conversations for user 1`);

    console.log('\n🎉 All chat functions updated successfully!');
    console.log('\n📝 Summary of fixes:');
    console.log('   • Fixed create_direct_conversation function');
    console.log('   • Fixed get_user_conversations function (removed flawed filtering)');
    console.log('   • Improved message retrieval logic');

  } catch (error) {
    console.error('❌ Error updating chat functions:', error);
  } finally {
    await pool.end();
  }
}

// Run the update function
updateChatFunctions();
