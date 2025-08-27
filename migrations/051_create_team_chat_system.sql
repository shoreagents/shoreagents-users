-- Create Team Chat System
-- This migration sets up the database structure for company-internal team messaging

-- Conversations table (for direct messages between team members)
CREATE TABLE team_conversations (
  id SERIAL PRIMARY KEY,
  conversation_type VARCHAR(20) DEFAULT 'direct', -- 'direct' or 'group'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- for additional conversation info
);

-- Conversation participants (who can see/participate in each conversation)
CREATE TABLE conversation_participants (
  conversation_id INTEGER REFERENCES team_conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  last_read_at TIMESTAMP,
  last_typing_at TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages table (encrypted team chat messages)
CREATE TABLE team_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES team_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'file', 'reaction'
  content TEXT, -- encrypted message content
  encrypted_content BYTEA, -- for additional encryption layer
  message_hash VARCHAR(64), -- for integrity verification
  reply_to_message_id INTEGER REFERENCES team_messages(id), -- for replies
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES users(id),
  metadata JSONB -- for reactions, mentions, etc.
);

-- Message delivery status (who has received/read each message)
CREATE TABLE message_delivery_status (
  message_id INTEGER REFERENCES team_messages(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  PRIMARY KEY (message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_team_messages_conversation_id ON team_messages(conversation_id);
CREATE INDEX idx_team_messages_sender_id ON team_messages(sender_id);
CREATE INDEX idx_team_messages_created_at ON team_messages(created_at);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_message_delivery_status_user_id ON message_delivery_status(user_id);

-- Function to update conversation's last_message_at
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_conversations 
  SET last_message_at = NEW.created_at,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update conversation timestamp
CREATE TRIGGER trg_update_conversation_last_message
  AFTER INSERT ON team_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Function to create a direct conversation between two users
CREATE OR REPLACE FUNCTION create_direct_conversation(user1_id INTEGER, user2_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  conversation_id INTEGER;
  existing_conversation_id INTEGER;
BEGIN
  -- Check if conversation already exists (only active ones)
  SELECT tc.id INTO existing_conversation_id
  FROM team_conversations tc
  JOIN conversation_participants cp1 ON tc.id = cp1.conversation_id
  JOIN conversation_participants cp2 ON tc.id = cp2.conversation_id
  WHERE tc.conversation_type = 'direct'
    AND cp1.user_id = user1_id
    AND cp2.user_id = user2_id
    AND cp1.user_id != cp2.user_id
    AND cp1.is_active = TRUE -- Only consider active conversations
    AND cp1.left_at IS NULL -- Don't consider conversations where user has left
    AND cp2.is_active = TRUE -- Only consider active conversations
    AND cp2.left_at IS NULL; -- Don't consider conversations where user has left
  
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

-- Function to get user's conversations
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

-- Add comments for documentation
COMMENT ON TABLE team_conversations IS 'Team chat conversations between company members';
COMMENT ON TABLE conversation_participants IS 'Users participating in each conversation';
COMMENT ON TABLE team_messages IS 'Encrypted chat messages between team members';
COMMENT ON TABLE message_delivery_status IS 'Message delivery and read status for each user';
COMMENT ON FUNCTION create_direct_conversation IS 'Creates a direct conversation between two team members';
COMMENT ON FUNCTION get_user_conversations IS 'Gets all conversations for a specific user with metadata';
