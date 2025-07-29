# Simple Ticketing Schema

This document explains the simple ticketing system database schema for ShoreAgents.

## Overview

The ticketing system consists of 3 main tables:
- `tickets` - Main ticket information
- `ticket_files` - File attachments  
- `users` - Links to existing user system

## Database Schema

### Core Table: `tickets`

| Field | Type | Description |
|-------|------|-------------|
| `id` | serial | Primary key |
| `ticket_id` | varchar(50) | Unique ticket ID (e.g., TKT-2024001) |
| `user_id` | int | Agent who created the ticket (FK to users) |
| `title` | text | Brief ticket title |
| `concern` | text | Main concern/issue |
| `details` | text | Detailed description |
| `category` | varchar(100) | Issue category |
| `status` | enum | pending, in-progress, resolved, on-hold |
| `resolved_by` | int | Agent who resolved the ticket (FK to users) |
| `resolved_at` | timestamp | When ticket was resolved |
| `created_at` | timestamp | Ticket creation time |
| `updated_at` | timestamp | Last update time |

### Supporting Tables

#### `ticket_files`
- File attachments for tickets
- Links to main ticket via `ticket_id`
- Stores file name, path, and size

## ENUM Types

```sql
-- Ticket Status
'pending' | 'in-progress' | 'resolved' | 'on-hold'
```

## Setup Instructions

### 1. Create Schema

```bash
# Run the ticketing migration
psql $DATABASE_URL -f migrations/004_ticketing_schema.sql
```

### 2. Seed Sample Data

```bash
# Create sample tickets
npm run seed-tickets
```

This creates 5 sample tickets:
- TKT-2024001: Email Login Issues (pending)
- TKT-2024002: Software Installation Request (in-progress)  
- TKT-2024003: VPN Connection Problems (resolved)
- TKT-2024004: Printer Not Working (pending)
- TKT-2024005: Access Request (pending)

## Usage Examples

### Creating a Ticket

```sql
INSERT INTO tickets (
    ticket_id, user_id, title, concern, details, 
    category, status
) VALUES (
    'TKT-2024006',
    1, -- Agent user ID
    'Password Reset Request',
    'Cannot reset password',
    'The password reset email is not being received',
    'Account Issue',
    'pending'
);
```

### Querying Tickets

```sql
-- Get all pending tickets
SELECT * FROM tickets WHERE status = 'pending';

-- Get tickets by agent
SELECT t.*, u.email as creator_email 
FROM tickets t 
JOIN users u ON t.user_id = u.id 
WHERE u.email = 'agent@shoreagents.com';

-- Get ticket with files
SELECT 
    t.*,
    array_agg(DISTINCT tf.file_name) as files
FROM tickets t
LEFT JOIN ticket_files tf ON t.id = tf.ticket_id
WHERE t.ticket_id = 'TKT-2024001'
GROUP BY t.id;
```

### Updating Ticket Status

```sql
-- Mark ticket as in-progress
UPDATE tickets 
SET status = 'in-progress', updated_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'TKT-2024001';

-- Resolve ticket (with resolver tracking)
UPDATE tickets 
SET status = 'resolved', 
    resolved_by = 1, -- Agent who resolved it
    resolved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'TKT-2024001';
```

## Integration with Existing App

The schema integrates with your existing user system:

- **Agent Users**: Can create and resolve tickets
- **User Authentication**: Uses existing auth system
- **Philippines Timezone**: All timestamps use Asia/Manila timezone
- **File Attachments**: Support for multiple file uploads per ticket

## Key Features

✅ **Simplified Workflow** - No complex priority or assignment systems  
✅ **Streamlined Comments** - Details field handles all ticket information  
✅ **Clear Resolution** - Track who resolved each ticket  
✅ **Consistent Timezone** - All timestamps in Philippines time  
✅ **File Support** - Multiple attachments per ticket  
✅ **Status Tracking** - pending, in-progress, resolved, on-hold

The ticketing system is designed to be simple yet effective for ShoreAgents' support workflow. 