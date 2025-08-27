-- Migration 052: Fix Team Chat Soft Delete
-- This migration fixes the soft delete functionality in team chat
-- so that when a user deletes a conversation, it's properly hidden from their view

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

-- Add comment for documentation
COMMENT ON FUNCTION get_user_conversations(INTEGER) IS 'Gets all active conversations for a specific user with metadata, properly filtering out deleted conversations';
