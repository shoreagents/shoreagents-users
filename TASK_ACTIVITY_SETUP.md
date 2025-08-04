# Task Activity System Setup

This document explains the task activity system that has been created for the ShoreAgents application.

## Overview

The task activity system provides a Kanban board-style task management interface with the following features:

- **Task Groups**: Organize tasks into columns (To Do, In Progress, Review, Done)
- **Task Management**: Create, move, update, and delete tasks
- **Position Tracking**: Automatic ordering of tasks within groups
- **Database-Driven**: All data is stored in PostgreSQL database

## Database Schema

### Tables Created

1. **task_groups** - Kanban columns/groups
   - `id` (serial, primary key)
   - `user_id` (foreign key to users.id)
   - `title` (varchar, unique per user)
   - `color` (varchar, CSS class for styling)
   - `position` (integer, ordering)
   - `is_default` (boolean, default groups)
   - `created_at`, `updated_at` (timestamps)

2. **tasks** - Individual task items
   - `id` (serial, primary key)
   - `user_id` (foreign key to users.id)
   - `group_id` (foreign key to task_groups.id)
   - `title` (varchar, required)
   - `description` (text, optional)
   - `priority` (enum: 'urgent', 'high', 'normal', 'low')
   - `assignee` (varchar, optional)
   - `due_date` (date, optional)
   - `tags` (text array, optional)
   - `position` (integer, ordering within group)
   - `status` (enum: 'active', 'deleted')
   - `created_at`, `updated_at` (timestamps)

### Functions Created

- `get_next_task_position(group_id)` - Get next position for a task in a group
- `create_default_task_groups(user_id)` - Create default groups for a user
- `update_task_updated_at_column()` - Trigger function for updated_at timestamps

## API Endpoints

### GET /api/task-activity
Fetches all task groups and tasks for the current user.

**Response:**
```json
{
  "success": true,
  "groups": [
    {
      "id": 1,
      "title": "To Do",
      "color": "bg-gray-100 dark:bg-gray-800",
      "position": 0,
      "is_default": true,
      "tasks": [
        {
          "id": 1,
          "title": "New Task",
          "description": "Task description",
          "priority": "normal",
          "assignee": "Unassigned",
          "due_date": "2025-01-30",
          "tags": [],
          "position": 1,
          "status": "active",
          "created_at": "2025-01-30T00:00:00Z",
          "updated_at": "2025-01-30T00:00:00Z"
        }
      ]
    }
  ]
}
```

### POST /api/task-activity
Performs various task operations based on the `action` parameter.

**Actions:**
- `create_task` - Create a new task
- `create_group` - Create a new task group
- `move_task` - Move a task to a different group

## Setup Instructions

### 1. Database Migration

Execute the migration file when the database is available:

```bash
# Option 1: Using the setup script (requires database connection)
node scripts/setup-task-activity.js

# Option 2: Manual execution
# Copy the contents of migrations/025_task_activity_schema.sql
# and execute in your PostgreSQL client
```

### 2. Environment Configuration

Ensure your database connection is configured:

```bash
# For local development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shoreagents_users

# Or use the local configuration in the API routes
```

### 3. Default Groups

The system automatically creates these default groups for each user:
- **To Do** (position 0)
- **In Progress** (position 1)
- **Review** (position 2)
- **Done** (position 3)

## Frontend Integration

### Components Created

1. **KanbanBoard** (`src/components/task-activity-components/kanban-board.tsx`)
   - Main Kanban board component
   - Drag and drop functionality
   - Task creation and management

2. **TaskDetailDialog** (`src/components/task-activity-components/task-detail-dialog.tsx`)
   - Detailed task view and editing
   - Task relationships and attachments

### Utilities

1. **task-activity-utils.ts** (`src/lib/task-activity-utils.ts`)
   - API wrapper functions
   - TypeScript interfaces
   - Helper functions

### API Routes

1. **/api/task-activity** (`src/app/api/task-activity/route.ts`)
   - Main API endpoint for task operations
   - GET: Fetch all tasks and groups
   - POST: Create tasks, groups, move tasks

## Usage

### Creating a Task
```typescript
import { createTask } from '@/lib/task-activity-utils'

const newTask = await createTask(groupId, 'Task Title', 'Description')
```

### Moving a Task
```typescript
import { moveTask } from '@/lib/task-activity-utils'

await moveTask(taskId, newGroupId)
```

### Creating a Group
```typescript
import { createGroup } from '@/lib/task-activity-utils'

const newGroup = await createGroup('New Group', 'bg-purple-50')
```

## Features

- ✅ **Database Schema**: Complete PostgreSQL schema with proper relationships
- ✅ **API Endpoints**: RESTful API for all CRUD operations
- ✅ **Position Tracking**: Automatic ordering of tasks and groups
- ✅ **Default Groups**: Automatic creation of default Kanban columns
- ✅ **TypeScript Support**: Full type definitions and interfaces
- ✅ **Error Handling**: Comprehensive error handling in API routes
- ✅ **User Isolation**: All data is scoped to the current user

## Next Steps

1. **Database Connection**: Ensure the database is running and accessible
2. **Migration Execution**: Run the migration to create the schema
3. **Frontend Integration**: Update the task activity page to use the new API
4. **Testing**: Test all CRUD operations and drag-and-drop functionality

## Files Created

- `migrations/025_task_activity_schema.sql` - Database schema migration
- `scripts/setup-task-activity.js` - Migration execution script
- `src/app/api/task-activity/route.ts` - Main API endpoint
- `src/lib/task-activity-utils.ts` - Frontend utilities
- `TASK_ACTIVITY_SETUP.md` - This setup guide 