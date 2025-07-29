# Simple Task Management Schema

This document explains the simple task management system database schema for ShoreAgents.

## Overview

The task management system consists of 5 main tables:
- `tasks` - Main task information
- `task_statuses` - Dynamic user-defined task statuses
- `task_types` - Dynamic user-defined task types
- `task_files` - File attachments  
- `users` - Links to existing user system

## Database Schema

### Core Table: `tasks`

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial | Primary key |
| `task_id` | varchar(100) | Unique task ID (e.g., task_xxx) |
| `user_id` | int | Agent who owns the task (FK to users) |
| `task_name` | varchar(255) | Task title/name |
| `assignee` | varchar(100) | Person assigned to the task |
| `status_id` | int | Foreign key to task_statuses table |
| `priority` | enum | low, medium, high |
| `task_type_id` | int | Foreign key to task_types table |
| `description` | text | Task description |
| `due_date` | date | When task is due |
| `created_by` | varchar(100) | Who created the task |
| `last_edited_by` | varchar(100) | Who last edited the task |
| `created_at` | timestamp | Task creation time |
| `updated_at` | timestamp | Last update time |

### Supporting Tables

#### `task_statuses`
- Dynamic user-defined task statuses
- Each user can create custom statuses with colors and behaviors
- Built-in default statuses: Not Started, In Progress, Done
- Supports ordering and completion flags

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | int | User who owns this status |
| `status_name` | varchar(100) | Name of the status |
| `status_color` | varchar(7) | Hex color for UI display |
| `status_order` | int | Display order |
| `is_default` | boolean | Whether this is a default status |
| `is_completed` | boolean | Whether tasks with this status are considered done |
| `description` | text | Optional description |

#### `task_types`
- Dynamic user-defined task types
- Each user can create custom task types with colors
- Built-in default types: Document, Bug, Feature, Polish
- Supports ordering for consistent display

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial | Primary key |
| `user_id` | int | User who owns this task type |
| `type_name` | varchar(100) | Name of the task type |
| `type_color` | varchar(7) | Hex color for UI display |
| `type_order` | int | Display order |
| `is_default` | boolean | Whether this is a default type |
| `description` | text | Optional description |

#### `task_files`
- File attachments for tasks
- Links to main task via `task_id`
- Stores file name, path, and size

## ENUM Types

```sql
-- Task Priority (only enum remaining)
'low' | 'medium' | 'high'

-- Task Status (Now Dynamic - stored in task_statuses table)
-- Default statuses: 'Not Started' | 'In Progress' | 'Done'
-- Users can add unlimited custom statuses with colors and behaviors

-- Task Type (Now Dynamic - stored in task_types table)
-- Default types: 'Document' | 'Bug' | 'Feature' | 'Polish'
-- Users can add unlimited custom task types with colors
```

## Setup Instructions

### 1. Create Schema

```bash
# Run the task migration
psql $DATABASE_URL -f migrations/005_tasks_schema.sql
```

### 2. Seed Sample Data

```bash
# Create sample tasks
npm run seed-tasks
```

## Usage Examples

### Creating a Task

```sql
-- First ensure user has default statuses and types
SELECT create_default_task_statuses(1);
SELECT create_default_task_types(1);

-- Insert task with dynamic status and type
INSERT INTO tasks (
    task_id, user_id, task_name, assignee, status_id, 
    priority, task_type_id, description, due_date,
    created_by, last_edited_by
) VALUES (
    'task_new_feature_001',
    1, -- Agent user ID
    'Implement Dark Mode',
    'John Developer',
    (SELECT get_task_status_id(1, 'Not Started')), -- Get status ID dynamically
    'medium',
    (SELECT get_task_type_id(1, 'Feature')), -- Get task type ID dynamically
    'Add dark mode toggle to user preferences',
    '2025-08-30',
    'Product Manager',
    'Product Manager'
);
```

### Querying Tasks

```sql
-- Get all tasks for an agent with status and type info
SELECT t.*, ts.status_name, ts.status_color, ts.is_completed,
       tt.type_name, tt.type_color
FROM tasks t
JOIN task_statuses ts ON t.status_id = ts.id
JOIN task_types tt ON t.task_type_id = tt.id
WHERE t.user_id = 1;

-- Get tasks by status (using join with task_statuses)
SELECT t.*, ts.status_name, ts.status_color, ts.is_completed,
       tt.type_name, tt.type_color
FROM tasks t
JOIN task_statuses ts ON t.status_id = ts.id
JOIN task_types tt ON t.task_type_id = tt.id
WHERE ts.status_name = 'In Progress';

-- Get tasks by type
SELECT t.*, ts.status_name, tt.type_name, tt.type_color
FROM tasks t
JOIN task_statuses ts ON t.status_id = ts.id
JOIN task_types tt ON t.task_type_id = tt.id
WHERE tt.type_name = 'Bug';

-- Get overdue tasks
SELECT t.*, ts.status_name, tt.type_name
FROM tasks t
JOIN task_statuses ts ON t.status_id = ts.id
JOIN task_types tt ON t.task_type_id = tt.id
WHERE t.due_date < CURRENT_DATE 
AND ts.is_completed = false;

-- Get task with files
SELECT 
    t.*,
    ts.status_name,
    ts.status_color,
    tt.type_name,
    tt.type_color,
    array_agg(DISTINCT tf.file_name) as files
FROM tasks t
JOIN task_statuses ts ON t.status_id = ts.id
JOIN task_types tt ON t.task_type_id = tt.id
LEFT JOIN task_files tf ON t.id = tf.task_id
WHERE t.task_id = 'task_new_feature_001'
GROUP BY t.id, ts.status_name, ts.status_color, tt.type_name, tt.type_color;
```

### Updating Task Status and Type

```sql
-- Mark task as in-progress
UPDATE tasks 
SET status_id = (SELECT get_task_status_id(1, 'In Progress')), 
    last_edited_by = 'Current User',
    updated_at = NOW() AT TIME ZONE 'Asia/Manila'
WHERE task_id = 'task_new_feature_001';

-- Change task type
UPDATE tasks 
SET task_type_id = (SELECT get_task_type_id(1, 'Bug')),
    last_edited_by = 'Current User',
    updated_at = NOW() AT TIME ZONE 'Asia/Manila'
WHERE task_id = 'task_new_feature_001';

-- Complete task
UPDATE tasks 
SET status_id = (SELECT get_task_status_id(1, 'Done')),
    last_edited_by = 'Current User', 
    updated_at = NOW() AT TIME ZONE 'Asia/Manila'
WHERE task_id = 'task_new_feature_001';
```

### Creating Custom Statuses and Types

```sql
-- Add a custom status for a user
INSERT INTO task_statuses (user_id, status_name, status_color, status_order, is_completed, description)
VALUES (1, 'Under Review', '#f59e0b', 4, false, 'Task is being reviewed by supervisor');

-- Add a custom task type
INSERT INTO task_types (user_id, type_name, type_color, type_order, description)
VALUES (1, 'Research', '#8b5cf6', 5, 'Research and investigation tasks');

-- Add a custom completion status
INSERT INTO task_statuses (user_id, status_name, status_color, status_order, is_completed, description)
VALUES (1, 'Deployed', '#10b981', 5, true, 'Task has been completed and deployed');
```

## Integration with Existing App

The schema integrates with your existing user system:

- **Agent Users**: Can create and manage tasks with custom statuses and types
- **User Authentication**: Uses existing auth system
- **Philippines Timezone**: All timestamps use Asia/Manila timezone
- **File Attachments**: Support for multiple file uploads per task

## Helper Functions

### `create_default_task_statuses(user_id)`
Creates default statuses (Not Started, In Progress, Done) for a user

### `create_default_task_types(user_id)`
Creates default task types (Document, Bug, Feature, Polish) for a user

### `get_task_status_id(user_id, status_name)`
Gets the status ID for a status name, with automatic fallback to defaults

### `get_task_type_id(user_id, type_name)`
Gets the task type ID for a type name, with automatic fallback to defaults

## Key Features

✅ **Dynamic Statuses** - Users can create custom statuses with colors  
✅ **Dynamic Task Types** - Users can create custom task types with colors  
✅ **Simple Structure** - Easy to understand and maintain  
✅ **User-Specific** - Tasks, statuses, and types belong to specific agents  
✅ **File Support** - Multiple attachments per task  
✅ **Priority Management** - Low, medium, high priorities  
✅ **Flexible Workflow** - Customizable status and type tracking  
✅ **Consistent Timezone** - All timestamps in Philippines time  
✅ **Audit Trail** - Track who created and last edited tasks

The task management system is designed to be simple yet powerful for ShoreAgents' productivity workflow. 