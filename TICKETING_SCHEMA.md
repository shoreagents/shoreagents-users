# Simple Ticketing Schema

This document explains the simple ticketing system database schema for ShoreAgents.

## Overview

The ticketing system consists of 4 main tables:
- `tickets` - Main ticket information
- `ticket_files` - File attachments  
- `ticket_comments` - Ticket updates and comments
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
| `comments` | text | Additional comments |
| `category` | varchar(100) | Issue category |
| `status` | enum | pending, in-progress, resolved |
| `priority` | enum | low, medium, high, urgent |
| `assigned_to` | int | Agent assigned to handle (FK to users) |
| `resolved_at` | timestamp | When ticket was resolved |
| `created_at` | timestamp | Ticket creation time |
| `updated_at` | timestamp | Last update time |

### Supporting Tables

#### `ticket_files`
- File attachments for tickets
- Links to main ticket via `ticket_id`
- Stores file name, path, and size

#### `ticket_comments`  
- Update history and comments
- Links to ticket and commenting user
- Supports internal vs public comments

## ENUM Types

```sql
-- Ticket Status
'pending' | 'in-progress' | 'resolved'

-- Priority Levels  
'low' | 'medium' | 'high' | 'urgent'
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
- TKT-2024001: Email Login Issues (high priority, pending)
- TKT-2024002: Software Installation Request (medium, in-progress)  
- TKT-2024003: VPN Connection Problems (high, resolved)
- TKT-2024004: Printer Not Working (low, pending)
- TKT-2024005: Access Request (urgent, pending)

## Usage Examples

### Creating a Ticket

```sql
INSERT INTO tickets (
    ticket_id, user_id, title, concern, details, 
    category, status, priority
) VALUES (
    'TKT-2024006',
    1, -- Agent user ID
    'Password Reset Request',
    'Cannot reset password',
    'The password reset email is not being received',
    'Account Issue',
    'pending',
    'medium'
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

-- Get ticket with files and comments
SELECT 
    t.*,
    array_agg(DISTINCT tf.file_name) as files,
    array_agg(DISTINCT tc.comment) as comments
FROM tickets t
LEFT JOIN ticket_files tf ON t.id = tf.ticket_id
LEFT JOIN ticket_comments tc ON t.id = tc.ticket_id  
WHERE t.ticket_id = 'TKT-2024001'
GROUP BY t.id;
```

### Updating Ticket Status

```sql
-- Mark ticket as in-progress
UPDATE tickets 
SET status = 'in-progress', updated_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'TKT-2024001';

-- Resolve ticket
UPDATE tickets 
SET status = 'resolved', 
    resolved_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE ticket_id = 'TKT-2024001';
```

### Adding Comments

```sql
INSERT INTO ticket_comments (ticket_id, user_id, comment, is_internal)
SELECT t.id, 1, 'Working on this issue now', false
FROM tickets t 
WHERE t.ticket_id = 'TKT-2024001';
```

## Integration with Existing App

The schema integrates with your existing user system:

- **Agent Users**: Can create and be assigned tickets
- **User Authentication**: Uses existing auth system
- **Profile Integration**: Links to user profiles for contact info

### Migration from localStorage

Current tickets in localStorage can be migrated:

```javascript
// Example migration script concept
const existingTickets = JSON.parse(localStorage.getItem('tickets'));
// Convert and insert into database...
```

## Performance Considerations

**Indexed Fields:**
- `user_id` - For agent ticket queries
- `status` - For status filtering  
- `assigned_to` - For assignment queries
- `created_at` - For date sorting
- `ticket_id` - For direct ticket lookup

**Query Optimization:**
- Use status indexes for dashboard views
- Use user_id indexes for agent-specific queries
- Use created_at for pagination

## Security Considerations

- **Agent-Only Access**: Only agents can create/view tickets
- **User Ownership**: Tickets linked to creator via user_id
- **File Upload**: File paths prepared for secure storage
- **Internal Comments**: Separate internal vs public comments

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run seed-tickets` | Create sample tickets |
| `npm run check-db` | Verify database connection |

## Future Enhancements

The simple schema supports future additions:
- **File Upload**: File paths ready for cloud storage
- **Email Integration**: Comment system for email notifications  
- **Departments**: Can add department-based assignment
- **SLA Tracking**: Timestamps support response time tracking
- **Escalation**: Priority system supports auto-escalation rules

This simple schema provides a solid foundation for the ShoreAgents ticketing system while remaining easy to understand and extend. 