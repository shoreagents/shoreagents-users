# Database Authentication Setup

This document explains how to set up and use the database-based authentication system for the ShoreAgents application.

## Overview

The application has been updated to use PostgreSQL database authentication with a comprehensive schema. The system uses multiple related tables:

- `users` - Basic user information and authentication
- `passwords` - Encrypted password storage 
- `personal_info` - Extended user profile information
- `members` - Company/organization information
- `agents` - Agent-specific data (experience points, department)
- `clients` - Client-specific data (department assignment)
- `job_info` - Detailed employment and job information

## Database Schema

The authentication system uses the following comprehensive database structure:

### Core Tables

1. **users**
   - `id` (serial, primary key)
   - `email` (text, unique, not null)
   - `user_type` (enum: 'Agent', 'Client', 'Internal')
   - `created_at`, `updated_at` (timestamps)

2. **passwords**
   - `id` (serial, primary key)
   - `user_id` (foreign key to users.id)
   - `password` (text, bcrypt hashed)
   - `created_at`, `updated_at` (timestamps)

3. **personal_info**
   - `id` (serial, primary key)
   - `user_id` (foreign key to users.id, unique)
   - `first_name`, `last_name` (required)
   - `middle_name`, `nickname` (optional)
   - `profile_picture`, `phone`, `birthday`, `city`, `address` (optional)
   - `gender` (enum: 'Male', 'Female', 'Other', 'Prefer not to say')
   - `created_at`, `updated_at` (timestamps)

### Organization Tables

4. **members**
   - `id` (serial, primary key)
   - `company` (text, required)
   - `address`, `phone`, `logo`, `service` (optional)
   - `status` (enum: 'Current Client', 'Lost Client')
   - `badge_color`, `country`, `website` (optional)
   - `created_at`, `updated_at` (timestamps)

### User Type Tables

5. **agents**
   - `user_id` (primary key, foreign key to users.id)
   - `exp_points` (integer, default 0)
   - `member_id` (foreign key to members.id)
   - `department_id` (integer, optional)
   - `created_at`, `updated_at` (timestamps)

6. **clients**
   - `user_id` (primary key, foreign key to users.id)
   - `member_id` (foreign key to members.id)
   - `department_id` (integer, optional)
   - `created_at`, `updated_at` (timestamps)

### Job Information

7. **job_info**
   - `id` (serial, primary key)
   - `employee_id` (varchar(20), unique)
   - `agent_user_id` OR `internal_user_id` (foreign keys, mutually exclusive)
   - `job_title`, `shift_period`, `shift_schedule`, `shift_time` (optional)
   - `work_setup`, `employment_status`, `hire_type`, `staff_source` (optional)
   - `start_date`, `exit_date` (dates, optional)
   - `created_at`, `updated_at` (timestamps)

## Setup Instructions

### 1. Database Configuration

Ensure your `DATABASE_URL` environment variable is set:

```bash
# For local development
DATABASE_URL=postgresql://username:password@localhost:5432/shoreagents

# For production (Railway, Heroku, etc.)
DATABASE_URL=postgresql://username:password@host:port/database
```

### 2. Create Database Schema

**Option A: Comprehensive Schema (Recommended)**
```sql
-- Execute the comprehensive migration file
-- Use your preferred PostgreSQL client (psql, pgAdmin, etc.)
\i migrations/003_comprehensive_schema.sql
```

**Option B: Basic Schema Only**
```sql
-- Execute the basic migration file (legacy)
\i migrations/002_user_auth_schema.sql
```

### 3. Test Database Connection

```bash
npm run check-db
```

This will verify that your database connection is working properly.

### 4. Seed Test Data

**Option A: Comprehensive Seeding (Recommended)**
```bash
npm run seed-db-full
```

This creates complete test data including:
- 3 companies (SHOREAGENTS MAIN, ARIA FIRST HOMES, BARRY PLANT REAL ESTATE)
- 4 users with full profiles, job info, and company assignments
- Experience points for agents
- Detailed work schedules and employment information

**Option B: Basic Seeding**
```bash
npm run seed-db
```

This creates basic user data only (legacy).

### 5. Test Accounts (Comprehensive)

After running `npm run seed-db-full`:

| Email | Password | Type | Company | Job Title | **Can Login** |
|-------|----------|------|---------|-----------|---------------|
| agent@shoreagents.com | shoreagents123 | Agent | SHOREAGENTS MAIN | Senior Virtual Assistant | ✅ **Yes** |
| agent0@shoreagents.com | shoreagents123 | Agent | BARRY PLANT REAL ESTATE | Sales and Property Management Administrator | ✅ **Yes** |
| client@shoreagents.com | shoreagents123 | Client | ARIA FIRST HOMES | - | ❌ **Access Denied** |
| internal@shoreagents.com | shoreagents123 | Internal | SHOREAGENTS MAIN | Operations Manager | ❌ **Access Denied** |

**Note**: Only Agent users can access this application. Client and Internal users will receive an "Access denied" error.

## Profile Page Features

The profile page now displays comprehensive information from the database:

### Personal Information Section
- Name, nickname, contact details
- Birthday, address, gender
- Profile picture support

### Job Information Section  
- Employee ID and job title
- Employment status and hire type
- Staff source and user type

### Schedule Information Section
- Shift period, schedule, and times
- Work setup (Remote, Hybrid, etc.)

### Company Information Section
- Company name and services
- Country and website
- Member status and contact info

### Experience Points (Agents Only)
- Total XP with progress bar
- Level progression system

### Account Status
- Employment and member status
- Start date and verification status
- Exit date (if applicable)

## API Endpoints

### POST /api/auth/login

Authenticates a user with email and password. **Only Agent users can login.**

**Request:**
```json
{
  "email": "agent@shoreagents.com",
  "password": "shoreagents123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "agent@shoreagents.com",
    "user_type": "Agent",
    "name": "Agent User",
    "role": "agent",
    // ... other user fields
  },
  "message": "Login successful"
}
```

**Authentication Error (401):**
```json
{
  "success": false,
  "error": "Invalid email or password"
}
```

**Access Denied Error (403):**
```json
{
  "success": false,
  "error": "Access denied. This application is restricted to Agent users only.",
  "userType": "Client"
}
```

### GET /api/profile

Fetches complete user profile data from the database.

**Success Response (200):**
```json
{
  "success": true,
  "profile": {
    "id_number": "SA001",
    "first_name": "Agent",
    "last_name": "User",
    "email": "agent@shoreagents.com",
    "job_title": "Senior Virtual Assistant",
    "employee_id": "SA001",
    "shift_period": "Day Shift",
    "shift_schedule": "Monday to Friday",
    "shift_time": "8:00 AM - 5:00 PM PHT",
    "work_setup": "Remote",
    "employment_status": "Regular",
    "company": "SHOREAGENTS MAIN",
    "service": "Virtual Assistant Services",
    "country": "Philippines",
    "exp_points": 1250,
    // ... other fields
  }
}
```

## Security Features

### Password Hashing
- Passwords are hashed using bcrypt with salt rounds of 12
- Original passwords are never stored in the database
- Password comparison is done securely using bcrypt.compare()

### Access Control
- **Agent-Only Access**: Only users with `user_type = 'Agent'` can login to the application
- Client and Internal users receive access denied error (HTTP 403)
- Authentication validates both password and user type before granting access

### Minimal Authentication Storage
- Only essential data stored in cookies/localStorage:
  ```json
  {
    "isAuthenticated": true,
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User Name",
      "role": "agent",
      "user_type": "Agent"
    }
  }
  ```
- Personal data fetched fresh from database when needed

## Development Scripts

| Script | Description |
|--------|-------------|
| `npm run check-db` | Test database connection |
| `npm run seed-db` | Populate database with basic test users |
| `npm run seed-db-full` | Populate database with comprehensive test data |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |

## Migration Files

- `migrations/002_user_auth_schema.sql` - Basic authentication tables
- `migrations/003_comprehensive_schema.sql` - Complete schema with job info

## Environment Variables

Required environment variables:

```bash
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=development|production
ENABLE_DATABASE_LOGGING=true|false (optional)
```

## Troubleshooting

### Common Issues

1. **Database connection failed**
   - Check DATABASE_URL environment variable
   - Verify database server is running
   - Check network connectivity

2. **Missing tables error**
   - Run the migration script: `migrations/003_comprehensive_schema.sql`
   - Verify schema was created successfully

3. **ENUM type errors**
   - Ensure all ENUM types are created properly
   - Check for case sensitivity in enum values

4. **Foreign key constraint errors**
   - Ensure proper order of data insertion
   - Use comprehensive seeding script: `npm run seed-db-full`

### Debug Commands

```bash
# Check database connection
npm run check-db

# Test database operations
npm run seed-db-full

# Check database tables
psql $DATABASE_URL -c "\dt"

# View users with job info
psql $DATABASE_URL -c "
SELECT u.email, u.user_type, pi.first_name, pi.last_name, ji.job_title, m.company 
FROM users u 
LEFT JOIN personal_info pi ON u.id = pi.user_id 
LEFT JOIN agents a ON u.id = a.user_id 
LEFT JOIN clients c ON u.id = c.user_id 
LEFT JOIN members m ON (a.member_id = m.id OR c.member_id = m.id)
LEFT JOIN job_info ji ON (ji.agent_user_id = a.user_id OR ji.internal_user_id = u.id);
"
``` 