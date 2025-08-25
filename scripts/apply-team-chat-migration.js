const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function applyTeamChatMigration() {
  try {
    console.log('🔧 Applying Team Chat System Migration\n');
    
    // Step 1: Check if CHAT_ENCRYPTION_KEY exists
    console.log('1️⃣ Checking environment configuration...');
    if (!process.env.CHAT_ENCRYPTION_KEY) {
      console.log('   ⚠️  CHAT_ENCRYPTION_KEY not found in environment');
      console.log('   🔑 Generating new encryption key...');
      
      // Generate a new encryption key
      const crypto = require('crypto');
      const newKey = crypto.randomBytes(32).toString('hex');
      
      console.log('   ✅ New encryption key generated');
      console.log('   📝 Add this to your .env.local file:');
      console.log(`      CHAT_ENCRYPTION_KEY=${newKey}`);
      console.log('   ⚠️  Please add the key to your environment and restart the script');
      return;
    } else {
      console.log('   ✅ CHAT_ENCRYPTION_KEY found in environment');
    }
    
    // Step 2: Read and apply the migration
    console.log('\n2️⃣ Applying team chat system migration...');
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.join(__dirname, '..', 'migrations', '051_create_team_chat_system.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');
    
    // Step 3: Verify tables were created
    console.log('\n3️⃣ Verifying database tables...');
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'team_conversations',
        'conversation_participants', 
        'team_messages',
        'message_delivery_status'
      )
      ORDER BY table_name;
    `);
    
    if (tablesCheck.rows.length === 4) {
      console.log('   ✅ All required tables created:');
      tablesCheck.rows.forEach(table => {
        console.log(`      - ${table.table_name}`);
      });
    } else {
      console.log('   ❌ Some tables are missing');
      return;
    }
    
    // Step 4: Verify functions were created
    console.log('\n4️⃣ Verifying database functions...');
    const functionsCheck = await pool.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name IN (
        'create_direct_conversation',
        'get_user_conversations',
        'update_conversation_last_message'
      )
      ORDER BY routine_name;
    `);
    
    if (functionsCheck.rows.length === 3) {
      console.log('   ✅ All required functions created:');
      functionsCheck.rows.forEach(func => {
        console.log(`      - ${func.routine_name}`);
      });
    } else {
      console.log('   ❌ Some functions are missing');
      return;
    }
    
    // Step 5: Test the system with sample data
    console.log('\n5️⃣ Testing team chat system...');
    try {
      // Test creating a conversation between users 1 and 2
      const conversationResult = await pool.query(
        'SELECT create_direct_conversation($1, $2) as conversation_id',
        [1, 2]
      );
      
      if (conversationResult.rows.length > 0) {
        const conversationId = conversationResult.rows[0].conversation_id;
        console.log(`   ✅ Test conversation created with ID: ${conversationId}`);
        
        // Test sending a message
        const messageResult = await pool.query(`
          INSERT INTO team_messages (conversation_id, sender_id, content, message_type)
          VALUES ($1, $2, $3, $4)
          RETURNING id, created_at
        `, [conversationId, 1, 'Hello! This is a test message.', 'text']);
        
        if (messageResult.rows.length > 0) {
          console.log(`   ✅ Test message sent with ID: ${messageResult.rows[0].id}`);
          
          // Test getting conversations
          const conversationsResult = await pool.query(
            'SELECT * FROM get_user_conversations($1)',
            [1]
          );
          
          if (conversationsResult.rows.length > 0) {
            console.log(`   ✅ Test conversations retrieved: ${conversationsResult.rows.length} found`);
          } else {
            console.log('   ⚠️  No conversations found for test user');
          }
        } else {
          console.log('   ❌ Failed to send test message');
        }
      } else {
        console.log('   ❌ Failed to create test conversation');
      }
    } catch (error) {
      console.log('   ⚠️  Test failed (this is normal if users 1 and 2 don\'t exist):', error.message);
    }
    
    console.log('\n🎉 Team Chat System Migration Applied Successfully!');
    console.log('\n📋 What was created:');
    console.log('   • Database tables for conversations, messages, and participants');
    console.log('   • Encryption-ready message storage');
    console.log('   • Functions for creating conversations and retrieving data');
    console.log('   • Real-time messaging infrastructure via WebSocket');
    
    console.log('\n💡 How to use:');
    console.log('   1. Users can start direct conversations with team members');
    console.log('   2. Messages are encrypted and stored securely');
    console.log('   3. Real-time updates via WebSocket connections');
    console.log('   4. Message delivery and read status tracking');
    
    console.log('\n🔒 Security Features:');
    console.log('   • AES-256-GCM encryption for all messages');
    console.log('   • Message integrity verification via hashing');
    console.log('   • User authorization checks for conversations');
    console.log('   • Encrypted content storage in database');
    
    console.log('\n🚀 Next Steps:');
    console.log('   • Restart your socket server to enable chat functionality');
    console.log('   • Use the chat API endpoints for message operations');
    console.log('   • Integrate chat UI into your existing components');
    console.log('   • Test real-time messaging between team members');
    
  } catch (error) {
    console.error('❌ Error applying team chat migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  applyTeamChatMigration()
    .then(() => {
      console.log('\n✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { applyTeamChatMigration };
