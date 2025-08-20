-- Migration: Task Assignment Notifications
-- Creates functions and triggers for real-time task assignment notifications

-- Function to create task assignment notifications
CREATE OR REPLACE FUNCTION create_task_assignment_notification()
RETURNS TRIGGER AS $$
DECLARE
    task_title TEXT;
    task_creator_id INTEGER;
    task_creator_name TEXT;
    assignee_name TEXT;
    assignee_email TEXT;
BEGIN
    -- Get task details
    SELECT t.title, t.user_id INTO task_title, task_creator_id
    FROM tasks t WHERE t.id = NEW.task_id;
    
    -- Get task creator name
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email)
    INTO task_creator_name
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = task_creator_id;
    
    -- Get assignee details
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email), u.email
    INTO assignee_name, assignee_email
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = NEW.user_id;
    
    -- Only create notification if the assignee is not the task creator
    IF NEW.user_id != task_creator_id THEN
        -- Create notification for the assigned user
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        VALUES (
            NEW.user_id,
            'task',
            'info',
            'You have been assigned to a task',
            COALESCE(task_creator_name, 'Someone') || ' assigned you to "' || COALESCE(task_title, 'a task') || '"',
            json_build_object(
                'task_id', NEW.task_id,
                'assigner_id', task_creator_id,
                'assigner_name', task_creator_name,
                'assignee_id', NEW.user_id,
                'assignee_name', assignee_name,
                'task_title', task_title,
                'action_url', '/productivity/task-activity?taskId=' || NEW.task_id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle task assignment removals
CREATE OR REPLACE FUNCTION handle_task_assignment_removal()
RETURNS TRIGGER AS $$
DECLARE
    task_title TEXT;
    task_creator_id INTEGER;
    task_creator_name TEXT;
    assignee_name TEXT;
BEGIN
    -- Get task details
    SELECT t.title, t.user_id INTO task_title, task_creator_id
    FROM tasks t WHERE t.id = OLD.task_id;
    
    -- Get task creator name
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email)
    INTO task_creator_name
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = task_creator_id;
    
    -- Get assignee name
    SELECT COALESCE(NULLIF(TRIM(CONCAT(COALESCE(pi.first_name,''),' ',COALESCE(pi.last_name,''))), ''), u.email)
    INTO assignee_name
    FROM users u
    LEFT JOIN personal_info pi ON pi.user_id = u.id
    WHERE u.id = OLD.user_id;
    
    -- Only create notification if the removed assignee is not the task creator
    IF OLD.user_id != task_creator_id THEN
        -- Create notification for the removed user
        INSERT INTO notifications (user_id, category, type, title, message, payload)
        VALUES (
            OLD.user_id,
            'task',
            'warning',
            'You have been removed from a task',
            COALESCE(task_creator_name, 'Someone') || ' removed you from "' || COALESCE(task_title, 'a task') || '"',
            json_build_object(
                'task_id', OLD.task_id,
                'remover_id', task_creator_id,
                'remover_name', task_creator_name,
                'removed_assignee_id', OLD.user_id,
                'removed_assignee_name', assignee_name,
                'task_title', task_title,
                'action_url', '/productivity/task-activity'
            )
        );
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task assignment notifications
DROP TRIGGER IF EXISTS trg_task_assignment_notification ON task_assignees;
CREATE TRIGGER trg_task_assignment_notification
    AFTER INSERT ON task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION create_task_assignment_notification();

-- Create trigger for task assignment removal notifications
DROP TRIGGER IF EXISTS trg_task_assignment_removal_notification ON task_assignees;
CREATE TRIGGER trg_task_assignment_removal_notification
    AFTER DELETE ON task_assignees
    FOR EACH ROW
    EXECUTE FUNCTION handle_task_assignment_removal();

-- Add comment
COMMENT ON FUNCTION create_task_assignment_notification() IS 'Creates notifications when users are assigned to tasks';
COMMENT ON FUNCTION handle_task_assignment_removal() IS 'Creates notifications when users are removed from tasks';
