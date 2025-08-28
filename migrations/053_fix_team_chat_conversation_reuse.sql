-- Migration 053: Fix Team Chat Conversation Reuse
-- This migration fixes the issue where new conversations are created instead of reusing existing ones
-- when a user soft-deletes a conversation and then tries to start a new one with the same user.

-- Add missing left_at column to conversation_participants table
ALTER TABLE conversation_participants 
ADD COLUMN IF NOT EXISTS left_at TIMESTAMP;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_conversation_participants_left_at 
ON conversation_participants(left_at);

-- Update the create_direct_conversation function to properly check for existing conversations
-- including soft-deleted ones, so we can reuse the same conversation ID
CREATE OR REPLACE FUNCTION create_direct_conversation(user1_id INTEGER, user2_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  conversation_id INTEGER;
  existing_conversation_id INTEGER;
BEGIN
  -- Check if conversation already exists (including soft-deleted ones)
  -- We want to reuse the same conversation ID even if one user deleted it
  SELECT tc.id INTO existing_conversation_id
  FROM team_conversations tc
  JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
  JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
  WHERE tc.conversation_type = 'direct'
    AND cp1.user_id = user1_id
    AND cp2.user_id = user2_id
    AND cp1.user_id != cp2.user_id;
  
  -- If conversation exists, reactivate both users and return it
  IF existing_conversation_id IS NOT NULL THEN
    -- Reactivate both users in the conversation
    UPDATE conversation_participants 
    SET is_active = TRUE, 
        left_at = NULL,
        joined_at = CASE 
          WHEN left_at IS NOT NULL THEN NOW() 
          ELSE joined_at 
        END
    WHERE conversation_id = existing_conversation_id 
      AND user_id IN (user1_id, user2_id);
    
    RETURN existing_conversation_id;
  END IF;
  
  -- Create new conversation only if none exists
  INSERT INTO team_conversations (conversation_type, metadata)
  VALUES ('direct', jsonb_build_object('participants', ARRAY[user1_id, user2_id]))
  RETURNING id INTO conversation_id;
  
  -- Add both users as participants
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (conversation_id, user1_id), (conversation_id, user2_id);
  
  RETURN conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Update the get_user_conversations function to properly handle soft-deleted conversations
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
    AND (cp.left_at IS NULL OR cp.left_at > tm.created_at) -- Don't show if user left before last message
  ORDER BY tc.last_message_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN conversation_participants.left_at IS 'Timestamp when user left the conversation (for soft delete)';
COMMENT ON FUNCTION create_direct_conversation IS 'Creates or reuses a direct conversation between two team members, preventing duplicate conversations';
