# Supabase + Railway Hybrid Authentication Setup

This guide explains how to set up the hybrid authentication system for the ShoreAgents application.

## Hybrid Architecture

- **Supabase**: Handles secure email/password authentication
- **Railway**: Provides user role validation and profile data
- **Security**: Email matching ensures users exist in both systems

## Environment Variables

Add these variables to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Authentication Flow

1. **User enters email/password** in login form
2. **Supabase authenticates** the credentials
3. **Railway validates** user role and profile:
   - Checks if email exists in Railway `users` table
   - Verifies `user_type = 'Agent'`
   - Fetches profile data from `personal_info` table
4. **Email matching** ensures security between systems
5. **Combined response** includes Supabase session + Railway profile

## Database Requirements

### Supabase Setup
- **No custom tables needed** - just enable Auth
- Users will be created in Supabase Auth only

### Railway Setup (existing)
- `users` table with `user_type = 'Agent'`
- `personal_info` table for profile data
- Email must match between systems

## Migration Steps

1. **Set up Supabase project** and get your environment variables
2. **Enable Supabase Auth** (no custom tables needed)
3. **Create Supabase accounts** for existing Railway users:
   - Export emails from Railway `users` table where `user_type = 'Agent'`
   - Create corresponding accounts in Supabase Auth
   - Users will need to set new passwords
4. **Update environment variables** in your deployment
5. **Test hybrid authentication flow**

## User Migration Script

Use this script to migrate existing users:

```javascript
// scripts/migrate-users-to-supabase.js
const { supabaseAdmin } = require('../src/lib/supabase')
const { executeQuery } = require('../src/lib/database-server')

async function migrateUsers() {
  // Get existing Agent users from Railway
  const existingUsers = await executeQuery(`
    SELECT u.email, u.user_type, u.created_at,
           pi.first_name, pi.last_name
    FROM users u
    LEFT JOIN personal_info pi ON u.id = pi.user_id
    WHERE u.user_type = 'Agent'
  `)

  for (const user of existingUsers) {
    try {
      // Create user in Supabase Auth (no custom tables needed)
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        email_confirm: true,
        user_metadata: {
          migrated_from_railway: true,
          original_created_at: user.created_at,
          full_name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
        }
      })

      if (error) {
        console.error(`Failed to create user ${user.email}:`, error)
      } else {
        console.log(`✅ Migrated user: ${user.email}`)
        console.log(`   User will need to reset password on first login`)
      }

    } catch (error) {
      console.error(`Error migrating ${user.email}:`, error)
    }
  }
  
  console.log('\n📧 Users will need to reset their passwords')
  console.log('📋 Railway profile data will be fetched automatically during login')
}

migrateUsers().catch(console.error)
```

## Features

- ✅ **Hybrid Authentication** - Supabase Auth + Railway validation
- ✅ **Email/Password Security** via Supabase Auth
- ✅ **Session Management** with automatic refresh
- ✅ **Agent-only Access** via Railway user_type validation
- ✅ **Email Matching Security** between systems
- ✅ **Profile Data** from existing Railway tables
- ✅ **Backward Compatibility** during migration period
- ✅ **Automatic Signout** for unauthorized users

## Notes

- Users will need to reset their passwords after migration
- The old Railway auth system will be gradually deprecated
- During transition, both systems will work simultaneously
- Agent verification is done via the `agent_profiles` table