-- Task Activity Schema Migration

-- Create task_groups table (Kanban columns)
CREATE TABLE IF NOT EXISTS task_groups (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    color VARCHAR(100) DEFAULT 'bg-gray-100 dark:bg-gray-800',
    position INTEGER NOT NULL DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
    UNIQUE(user_id, title)
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id INTEGER NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    assignees INTEGER[] DEFAULT '{}', -- references users(id)
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    tags TEXT[],
    position INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_at timestamptz DEFAULT now() NULL,
    updated_at timestamptz DEFAULT now() NULL
);

-- If the table already existed, ensure new columns are present
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignees INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;

-- Remove legacy single-assignee column now that assignees[] exists
ALTER TABLE tasks
  DROP COLUMN IF EXISTS assignee;

  ALTER TABLE tasks
  DROP COLUMN IF EXISTS due_date;

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION update_task_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'Asia/Manila';
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers (after tables are created)
CREATE TRIGGER update_task_groups_updated_at 
    BEFORE UPDATE ON task_groups 
    FOR EACH ROW EXECUTE FUNCTION update_task_updated_at_column();

CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW EXECUTE FUNCTION update_task_updated_at_column();

-- Create indexes (after tables are created)
CREATE INDEX IF NOT EXISTS idx_task_groups_user_id ON task_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks(group_id);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(group_id, position);

-- Function to get next position for a task
CREATE OR REPLACE FUNCTION get_next_task_position(group_id_param INTEGER)
RETURNS INTEGER AS $$
DECLARE
    next_position INTEGER;
BEGIN
    SELECT COALESCE(MAX(position), 0) + 1
    INTO next_position
    FROM tasks
    WHERE group_id = group_id_param AND status = 'active';
    
    RETURN next_position;
END;
$$ LANGUAGE plpgsql;

-- Function to create default groups
CREATE OR REPLACE FUNCTION create_default_task_groups(user_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO task_groups (user_id, title, color, position, is_default)
    VALUES 
        (user_id_param, 'To Do', 'bg-gray-100 dark:bg-gray-800', 0, true),
        (user_id_param, 'In Progress', 'bg-blue-50 dark:bg-blue-950/20', 1, true),
        (user_id_param, 'Review', 'bg-yellow-50 dark:bg-yellow-950/20', 2, true),
        (user_id_param, 'Done', 'bg-green-50 dark:bg-green-950/20', 3, true)
    ON CONFLICT (user_id, title) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Insert default groups for existing users
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN SELECT id FROM users
    LOOP
        PERFORM create_default_task_groups(user_record.id);
    END LOOP;
END $$; 