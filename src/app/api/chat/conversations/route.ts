import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { chatEncryption } from '@/lib/chat-encryption';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function POST(request: NextRequest) {
  try {
    const { action, userId, otherUserId, messageContent, conversationId } = await request.json();

    switch (action) {
      case 'create_conversation':
        return await createConversation(userId, otherUserId);
      
      case 'find_conversation':
        return await findConversation(userId, otherUserId);
      
      case 'send_message':
        return await sendMessage(userId, conversationId, messageContent);
      
      case 'get_conversations':
        return await getUserConversations(userId);
      
      case 'get_all_conversations':
        return await getAllUserConversations(userId);
      
      case 'get_messages':
        return await getConversationMessages(userId, conversationId);
      
      case 'delete_conversation':
        return await deleteConversation(userId, conversationId);
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Create a new direct conversation between two users
 */
async function createConversation(userId: number, otherUserId: number) {
  try {
    const result = await pool.query(
      'SELECT create_direct_conversation($1, $2) as conversation_id',
      [userId, otherUserId]
    );
    
    const conversationId = result.rows[0].conversation_id;
    
    return NextResponse.json({
      success: true,
      conversationId,
      message: 'Conversation created successfully'
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}

/**
 * Find existing conversation between two users
 */
async function findConversation(userId: number, otherUserId: number) {
  try {
    // Find conversations where both users participated
    // The current user must be active, but the other user can be inactive (soft-deleted)
    // This allows users to see conversations even if the other person deleted them
    const result = await pool.query(
      `SELECT tc.id, tc.conversation_type, tc.metadata,
              cp1.is_active as current_user_active,
              cp1.left_at as current_user_left_at,
              cp2.is_active as other_user_active,
              cp2.left_at as other_user_left_at
       FROM team_conversations tc
       JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
       JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
       WHERE tc.conversation_type = 'direct'
         AND cp1.user_id = $1
         AND cp2.user_id = $2
         AND cp1.user_id != cp2.user_id
         AND cp1.is_active = TRUE -- Current user must still be active
         AND cp1.left_at IS NULL -- Current user hasn't left
       ORDER BY tc.created_at DESC -- Get the most recent conversation
       LIMIT 1`,
      [userId, otherUserId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No conversation found between these users'
      });
    }
    
    const conversation = result.rows[0];
    
    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      conversation: {
        ...conversation,
        otherUserDeleted: !conversation.other_user_active || conversation.other_user_left_at !== null
      }
    });
  } catch (error) {
    console.error('Error finding conversation:', error);
    return NextResponse.json(
      { error: 'Failed to find conversation' },
      { status: 500 }
    );
  }
}

/**
 * Send a message in a conversation
 */
async function sendMessage(userId: number, conversationId: number, content: string) {
  try {
    // First, verify this is the correct conversation for these users
    const conversationCheck = await pool.query(
      `SELECT tc.id, tc.conversation_type, tc.metadata
       FROM team_conversations tc
       JOIN conversation_participants cp ON tc.id = cp.conversation_id
       WHERE tc.id = $1 
         AND tc.conversation_type = 'direct'
         AND cp.user_id = $2
         AND cp.is_active = TRUE -- Only allow messages if user is still active
         AND cp.left_at IS NULL -- Don't allow messages if user has left`,
      [conversationId, userId]
    );
    
    if (conversationCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found, user not authorized, or conversation deleted' },
        { status: 404 }
      );
    }
    
    const conversation = conversationCheck.rows[0];
    
    // Verify user is participant in conversation
    const participantCheck = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE AND left_at IS NULL',
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not authorized for this conversation or conversation deleted' },
        { status: 403 }
      );
    }
    
    // Encrypt the message
    const encrypted = chatEncryption.encryptMessage(content);
    
    // Store the encrypted message
    const messageResult = await pool.query(
      `INSERT INTO team_messages 
       (conversation_id, sender_id, content, encrypted_content, message_hash, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        conversationId,
        userId,
        content, // Store plain text for now (you can remove this for full encryption)
        encrypted.encryptedContent,
        encrypted.messageHash,
        JSON.stringify({ iv: encrypted.iv, authTag: encrypted.authTag })
      ]
    );
    
    const messageId = messageResult.rows[0].id;
    const createdAt = messageResult.rows[0].created_at;
    
    // Get conversation participants for delivery status
    const participants = await pool.query(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = $1',
      [conversationId]
    );
    
    // Create delivery status records
    const deliveryStatusValues = participants.rows
      .map((_, index) => `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`)
      .join(', ');
    
    const deliveryStatusParams = participants.rows.flatMap(participant => [
      messageId,
      participant.user_id,
      participant.user_id === userId ? new Date() : null // Mark as delivered for sender
    ]);
    
    if (deliveryStatusValues) {
      await pool.query(
        `INSERT INTO message_delivery_status (message_id, user_id, delivered_at)
         VALUES ${deliveryStatusValues}`,
        deliveryStatusParams
      );
    }
    
    return NextResponse.json({
      success: true,
      messageId,
      createdAt,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}

/**
 * Soft delete a conversation for a specific user
 */
async function deleteConversation(userId: number, conversationId: number) {
  try {
    // First, verify this user is a participant in the conversation
    const participantCheck = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not authorized for this conversation' },
        { status: 403 }
      );
    }

    // Soft delete by marking the user as inactive in the conversation
    await pool.query(
      `UPDATE conversation_participants 
       SET is_active = FALSE, 
           left_at = NOW()
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    // Mark ALL messages as deleted for this user (both sent and received)
    await pool.query(
      `INSERT INTO message_delivery_status (message_id, user_id, deleted_at)
       SELECT tm.id, $1, NOW()
       FROM team_messages tm
       WHERE tm.conversation_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM message_delivery_status mds 
           WHERE mds.message_id = tm.id AND mds.user_id = $1
         )
       ON CONFLICT (message_id, user_id) 
       DO UPDATE SET deleted_at = NOW()`,
      [userId, conversationId]
    );

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}

/**
 * Get user's active conversations list (excludes soft-deleted conversations)
 */
async function getUserConversations(userId: number) {
  try {
    const result = await pool.query(
      'SELECT * FROM get_user_conversations($1)',
      [userId]
    );
    
    return NextResponse.json({
      success: true,
      conversations: result.rows
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    return NextResponse.json(
      { error: 'Failed to get conversations' },
      { status: 500 }
    );
  }
}

/**
 * Get ALL user's conversations including soft-deleted ones
 * This shows the full conversation history even if other users deleted conversations
 */
async function getAllUserConversations(userId: number) {
  try {
    const result = await pool.query(
      `SELECT 
         tc.id,
         tc.conversation_type,
         tc.created_at,
         tc.updated_at,
         tc.last_message_at,
         tc.metadata,
         -- Get the other participant's info
         other_user.id as other_user_id,
         other_user.email as other_user_email,
         COALESCE(other_pi.first_name || ' ' || other_pi.last_name, other_user.email) as other_user_name,
         -- Check if current user deleted this conversation
         cp.is_active as current_user_active,
         cp.left_at as current_user_left_at,
         -- Check if other user deleted this conversation
         other_cp.is_active as other_user_active,
         other_cp.left_at as other_user_left_at
       FROM team_conversations tc
       JOIN conversation_participants cp ON tc.id = cp.conversation_id
       JOIN conversation_participants other_cp ON tc.id = other_cp.conversation_id
       JOIN users other_user ON other_cp.user_id = other_user.id
       LEFT JOIN personal_info other_pi ON other_user.id = other_pi.user_id
       WHERE tc.conversation_type = 'direct'
         AND cp.user_id = $1
         AND other_cp.user_id != $1
         AND cp.is_active = TRUE -- Current user must still be active
         AND cp.left_at IS NULL -- Current user hasn't left
       ORDER BY tc.last_message_at DESC NULLS LAST, tc.created_at DESC`,
      [userId]
    );
    
    // Add metadata about conversation status
    const conversations = result.rows.map(conv => ({
      ...conv,
      isDeletedByCurrentUser: false, // Current user is always active in this query
      isDeletedByOtherUser: !conv.other_user_active || conv.other_user_left_at !== null,
      status: !conv.other_user_active || conv.other_user_left_at !== null ? 'deleted_by_other' : 'active'
    }));
    
    return NextResponse.json({
      success: true,
      conversations: conversations
    });
  } catch (error) {
    console.error('Error getting all conversations:', error);
    return NextResponse.json(
      { error: 'Failed to get conversations' },
      { status: 500 }
    );
  }
}

/**
 * Get messages for a specific conversation
 */
async function getConversationMessages(userId: number, conversationId: number) {
  try {
    // First verify user is still active in this conversation
    const participantCheck = await pool.query(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2 AND is_active = TRUE AND left_at IS NULL',
      [conversationId, userId]
    );
    
    if (participantCheck.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Conversation not found or user not authorized'
      }, { status: 403 });
    }
    
    // Check if the other participant has soft-deleted this conversation
    const otherParticipantCheck = await pool.query(
      `SELECT cp.is_active, cp.left_at
       FROM conversation_participants cp
       WHERE cp.conversation_id = $1 AND cp.user_id != $2`,
      [conversationId, userId]
    );
    
    const otherUserDeleted = otherParticipantCheck.rows.length > 0 && 
                            (!otherParticipantCheck.rows[0].is_active || 
                             otherParticipantCheck.rows[0].left_at !== null);
    
    // Get messages, excluding those deleted by the current user
    const messages = await pool.query(
      `SELECT
         tm.id,
         tm.sender_id,
         tm.content,
         tm.message_type,
         tm.created_at,
         tm.reply_to_message_id,
         tm.metadata,
         TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as sender_name,
         u.email as sender_email
       FROM team_messages tm
       JOIN users u ON tm.sender_id = u.id
       LEFT JOIN personal_info pi ON tm.sender_id = pi.user_id
       LEFT JOIN message_delivery_status mds ON tm.id = mds.message_id AND mds.user_id = $1
       WHERE tm.conversation_id = $2
         AND tm.is_deleted = FALSE
         AND (mds.deleted_at IS NULL OR mds.deleted_at > tm.created_at) -- Don't show messages deleted by user
       ORDER BY tm.created_at ASC
       LIMIT 100`,
      [userId, conversationId]
    );

    return NextResponse.json({
      success: true,
      messages: messages.rows,
      conversationInfo: {
        otherUserDeleted: otherUserDeleted
      }
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    );
  }
}
