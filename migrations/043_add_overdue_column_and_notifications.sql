-- Migration: Add Overdue Column and Overdue Notification Logic
-- This migration adds an "Overdue" column to prevent spamming overdue notifications

-- First, let's add the Overdue column to the default groups function
-- Note: task_groups are now global, so we don't need user_id parameter
CREATE OR REPLACE FUNCTION create_default_task_groups(user_id_param INTEGER DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    INSERT INTO task_groups (title, color, position, is_default, created_by)
    VALUES 
        ('To Do', 'bg-gray-200 dark:bg-gray-800', 0, true, user_id_param),
        ('In Progress', 'bg-blue-100 dark:bg-blue-950/20', 1, true, user_id_param),
        ('Review', 'bg-yellow-100 dark:bg-yellow-950/20', 2, true, user_id_param),
        ('On Hold', 'bg-purple-100 dark:bg-purple-950/20', 3, true, user_id_param),
        ('Done', 'bg-green-100 dark:bg-green-950/20', 4, true, user_id_param),
        ('Overdue', 'bg-red-200 dark:bg-red-950/20', 5, true, user_id_param)
    ON CONFLICT (title) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Add Overdue column for all users (since task_groups are now global)
DO $$
BEGIN
    -- Check if Overdue column already exists
    IF NOT EXISTS (
        SELECT 1 FROM task_groups 
        WHERE title = 'Overdue'
    ) THEN
        -- Add Overdue column at position 5 (after Done column)
        INSERT INTO task_groups (title, color, position, is_default, created_by)
        VALUES ('Overdue', 'bg-red-200 dark:bg-red-950/20', 5, true, 2);
        
        -- Update positions of existing columns if needed
        UPDATE task_groups 
        SET position = position + 1 
        WHERE position >= 5 AND title != 'Overdue';
    END IF;
END $$;

-- Function to check and move overdue tasks to Overdue column
CREATE OR REPLACE FUNCTION move_overdue_tasks_to_overdue_column()
RETURNS INTEGER AS $$
DECLARE
    task_record RECORD;
    overdue_group_id INTEGER;
    tasks_moved INTEGER := 0;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
BEGIN
    -- Get the Overdue column ID (global for all users)
    SELECT id INTO overdue_group_id
    FROM task_groups 
    WHERE title = 'Overdue';
    
    -- If Overdue column doesn't exist, return 0
    IF overdue_group_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Loop through all active tasks that are overdue
    FOR task_record IN
        SELECT 
            t.id,
            t.user_id,
            t.group_id,
            t.title
        FROM tasks t
        WHERE t.due_date IS NOT NULL
        AND t.status = 'active'
        AND t.due_date < now_ts
        AND t.group_id != overdue_group_id  -- Exclude tasks already in Overdue column
        AND t.group_id NOT IN (  -- Exclude tasks already in Done column
            SELECT id FROM task_groups WHERE title = 'Done'
        )
    LOOP
        -- Move task to Overdue column
        UPDATE tasks 
        SET group_id = overdue_group_id,
            position = (SELECT COALESCE(MAX(position), 0) + 1 FROM tasks WHERE group_id = overdue_group_id AND status = 'active'),
            updated_at = now_ts
        WHERE id = task_record.id;
        
        tasks_moved := tasks_moved + 1;
    END LOOP;
    
    RETURN tasks_moved;
END;
$$ LANGUAGE plpgsql;

-- Function to check overdue task notifications (prevents spamming)
CREATE OR REPLACE FUNCTION check_overdue_task_notifications()
RETURNS INTEGER AS $$
DECLARE
    task_record RECORD;
    notifications_sent INTEGER := 0;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
    hours_overdue numeric;
    overdue_group_id INTEGER;
BEGIN
    -- Loop through all active overdue tasks
    FOR task_record IN
        SELECT 
            t.id,
            t.title,
            t.due_date,
            t.user_id,
            t.group_id,
            t.status,
            -- Check if overdue notification already sent for this task in the last 6 hours
            CASE 
                WHEN EXISTS(
                    SELECT 1 FROM notifications n 
                    WHERE n.user_id = t.user_id 
                    AND n.category = 'task' 
                    AND n.title = 'Task overdue'
                    AND n.payload->>'task_id' = t.id::text
                    AND n.created_at > now() - INTERVAL '6 hours'
                ) THEN true
                ELSE false
            END as notification_sent_recently
        FROM tasks t
        WHERE t.due_date IS NOT NULL 
        AND t.status = 'active'
        AND t.due_date < now_ts
        AND t.group_id NOT IN (  -- Exclude tasks already in Done column
            SELECT id FROM task_groups WHERE title = 'Done'
        )
    LOOP
        -- Skip if notification was sent recently (within 6 hours)
        IF task_record.notification_sent_recently THEN
            CONTINUE;
        END IF;
        
        -- Get the Overdue column ID (global for all users)
        SELECT id INTO overdue_group_id
        FROM task_groups 
        WHERE title = 'Overdue';
        
        -- Only send notification if task is NOT in Overdue column
        -- This prevents spamming once tasks are moved to Overdue
        IF overdue_group_id IS NULL OR task_record.group_id != overdue_group_id THEN
            -- Calculate hours overdue
            hours_overdue := EXTRACT(EPOCH FROM (now_ts - task_record.due_date)) / 3600.0;
            
            -- Send notification for overdue tasks
            INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
            VALUES (
                task_record.user_id,
                'task',
                'error',
                'Task overdue',
                format('"%s" is overdue by %s hours (was due on %s)', 
                    task_record.title, 
                    round(hours_overdue, 1),
                    to_char(task_record.due_date AT TIME ZONE 'Asia/Manila', 'Mon DD, YYYY HH24:MI')
                ),
                jsonb_build_object(
                    'task_id', task_record.id, 
                    'group_id', task_record.group_id, 
                    'due_date', task_record.due_date, 
                    'action_url', '/productivity/task-activity',
                    'hours_overdue', round(hours_overdue, 1)
                ),
                now_ts
            );
            
            notifications_sent := notifications_sent + 1;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$ LANGUAGE plpgsql;

-- Function to check task due notifications (for tasks not yet overdue)
CREATE OR REPLACE FUNCTION check_task_due_notifications()
RETURNS INTEGER AS $$
DECLARE
    task_record RECORD;
    notifications_sent INTEGER := 0;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
    hours_diff numeric;
    overdue_group_id INTEGER;
BEGIN
    -- Loop through all active tasks that have due dates (not yet overdue)
    FOR task_record IN
        SELECT 
            t.id,
            t.title,
            t.due_date,
            t.user_id,
            t.group_id,
            t.status,
            -- Check if notification already sent for this task in the last 12 hours
            CASE 
                WHEN EXISTS(
                    SELECT 1 FROM notifications n 
                    WHERE n.user_id = t.user_id 
                    AND n.category = 'task' 
                    AND n.title = 'Task due soon'
                    AND n.payload->>'task_id' = t.id::text
                    AND n.created_at > now() - INTERVAL '12 hours'
                ) THEN true
                ELSE false
            END as notification_sent_recently
        FROM tasks t
        WHERE t.due_date IS NOT NULL 
        AND t.status = 'active'
        AND t.due_date > now_ts
        AND t.due_date <= now_ts + INTERVAL '24 hours'
        AND t.group_id NOT IN (  -- Exclude tasks already in Done column
            SELECT id FROM task_groups WHERE title = 'Done'
        )
    LOOP
        -- Skip if notification was sent recently (within 12 hours)
        IF task_record.notification_sent_recently THEN
            CONTINUE;
        END IF;
        
        -- Get the Overdue column ID (global for all users)
        SELECT id INTO overdue_group_id
        FROM task_groups 
        WHERE title = 'Overdue';
        
        -- Only send notification if task is NOT in Overdue column
        IF overdue_group_id IS NULL OR task_record.group_id != overdue_group_id THEN
            -- Calculate hours until due
            hours_diff := EXTRACT(EPOCH FROM (task_record.due_date - now_ts)) / 3600.0;
            
            -- Send notification if due within next 24 hours
            IF hours_diff <= 24 AND hours_diff >= 0 THEN
                INSERT INTO notifications (user_id, category, type, title, message, payload, created_at)
                VALUES (
                    task_record.user_id,
                    'task',
                    'warning',
                    'Task due soon',
                    format('"%s" is due on %s', task_record.title, to_char(task_record.due_date AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI')),
                    jsonb_build_object(
                        'task_id', task_record.id, 
                        'group_id', task_record.group_id, 
                        'due_date', task_record.due_date, 
                        'action_url', '/productivity/task-activity',
                        'hours_until_due', round(hours_diff, 1)
                    ),
                    now_ts
                );
                
                notifications_sent := notifications_sent + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN notifications_sent;
END;
$$ LANGUAGE plpgsql;

-- Function to check all task notifications (combines both functions)
CREATE OR REPLACE FUNCTION check_all_task_notifications()
RETURNS INTEGER AS $$
DECLARE
    total_notifications INTEGER := 0;
BEGIN
    -- First, move overdue tasks to Overdue column
    PERFORM move_overdue_tasks_to_overdue_column();
    
    -- Check for overdue notifications (prevents spamming)
    total_notifications := total_notifications + check_overdue_task_notifications();
    
    -- Check for due soon notifications
    total_notifications := total_notifications + check_task_due_notifications();
    
    RETURN total_notifications;
END;
$$ LANGUAGE plpgsql;

-- Create the notify_task_due_soon function to respect Overdue column
CREATE OR REPLACE FUNCTION notify_task_due_soon()
RETURNS TRIGGER AS $$
DECLARE
    due_ts timestamptz;
    now_ts timestamptz := now() AT TIME ZONE 'Asia/Manila';
    hours_diff numeric;
    overdue_group_id INTEGER;
    done_group_id INTEGER;
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        due_ts := NEW.due_date;
        IF due_ts IS NULL THEN
            RETURN NEW;
        END IF;
        
        -- Get the Overdue column ID (global for all users)
        SELECT id INTO overdue_group_id
        FROM task_groups 
        WHERE title = 'Overdue';
        
        -- Get the Done column ID (global for all users)
        SELECT id INTO done_group_id
        FROM task_groups 
        WHERE title = 'Done';
        
        -- Only send notification if task is NOT in Overdue column AND NOT in Done column
        IF (overdue_group_id IS NULL OR NEW.group_id != overdue_group_id) 
           AND (done_group_id IS NULL OR NEW.group_id != done_group_id) THEN
            -- Compute hours until due
            hours_diff := EXTRACT(EPOCH FROM (due_ts - now_ts)) / 3600.0;
            
            -- If due within next 24h and still active, create a warning notification
            IF hours_diff <= 24 AND hours_diff >= 0 AND NEW.status = 'active' THEN
                INSERT INTO public.notifications (user_id, category, type, title, message, payload)
                VALUES (
                    NEW.user_id,
                    'task',
                    'warning',
                    'Task due soon',
                    format('"%s" is due on %s', NEW.title, to_char(due_ts AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI')),
                    json_build_object('task_id', NEW.id, 'group_id', NEW.group_id, 'due_date', NEW.due_date, 'action_url', '/productivity/task-activity')
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task due soon notifications
DROP TRIGGER IF EXISTS trg_task_due_soon ON tasks;
CREATE TRIGGER trg_task_due_soon
    AFTER INSERT OR UPDATE OF due_date, status ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION notify_task_due_soon();

-- Add comments
COMMENT ON FUNCTION move_overdue_tasks_to_overdue_column() IS 'Automatically moves overdue tasks to the Overdue column';
COMMENT ON FUNCTION check_overdue_task_notifications() IS 'Sends overdue notifications only for tasks not in Overdue column (prevents spamming)';
COMMENT ON FUNCTION check_task_due_notifications() IS 'Sends due soon notifications for tasks not yet overdue';
COMMENT ON FUNCTION check_all_task_notifications() IS 'Main function that handles all task notifications and moves overdue tasks';
COMMENT ON FUNCTION notify_task_due_soon() IS 'Updated trigger function that respects Overdue column to prevent notification spamming';

-- Test function to manually trigger overdue task processing
CREATE OR REPLACE FUNCTION test_overdue_system()
RETURNS TEXT AS $$
DECLARE
    tasks_moved INTEGER;
    notifications_sent INTEGER;
    result_text TEXT;
BEGIN
    -- Move overdue tasks
    SELECT move_overdue_tasks_to_overdue_column() INTO tasks_moved;
    
    -- Send notifications
    SELECT check_all_task_notifications() INTO notifications_sent;
    
    result_text := format('Overdue system test completed. Tasks moved: %s, Notifications sent: %s', tasks_moved, notifications_sent);
    
    RETURN result_text;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION test_overdue_system() IS 'Test function to manually trigger overdue task processing for testing purposes';
