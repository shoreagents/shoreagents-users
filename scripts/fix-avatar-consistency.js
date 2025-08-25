require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixAvatarConsistency() {
  try {
    console.log('🔧 Fixing Avatar Consistency Issue...\n');

    // 1. Update the get_user_conversations function
    console.log('1️⃣ Updating get_user_conversations function...');
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
          GROUP BY tm2.conversation_id
        ) unread ON tc.id = unread.conversation_id
        WHERE cp.user_id = user_id_param
          AND other_cp.user_id != user_id_param
        ORDER BY tc.last_message_at DESC NULLS LAST;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('✅ Updated get_user_conversations function');

    // 2. Test the function to make sure it works
    console.log('\n2️⃣ Testing the updated function...');
    const testResult = await pool.query('SELECT * FROM get_user_conversations(1) LIMIT 1');
    console.log('✅ Function test successful, returned', testResult.rows.length, 'rows');

    // 3. Check current messages to see the sender_name format
    console.log('\n3️⃣ Checking current message sender names...');
    const messagesResult = await pool.query(`
      SELECT 
        tm.id,
        tm.sender_id,
        TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as sender_name,
        u.email
      FROM team_messages tm
      JOIN users u ON tm.sender_id = u.id
      LEFT JOIN personal_info pi ON tm.sender_id = pi.user_id
      LIMIT 5
    `);
    
    console.log('📝 Sample message sender names:');
    messagesResult.rows.forEach((msg, index) => {
      console.log(`   Message ${index + 1}: User ${msg.sender_id} (${msg.email}) - Name: "${msg.sender_name}"`);
    });

    console.log('\n🎉 Avatar consistency fix completed!');
    console.log('📋 What was fixed:');
    console.log('   • Updated get_user_conversations function to use consistent name construction');
    console.log('   • Both sidebar and chat messages now use the same name logic');
    console.log('   • Avatars should now show consistently (KP instead of just K)');

  } catch (error) {
    console.error('❌ Error fixing avatar consistency:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixAvatarConsistency();
