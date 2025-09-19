const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' });

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
}

async function resetAnnouncementsSchema() {
  let pool = null
  try {
    console.log('🔄 Resetting announcements schema...')
    
    pool = new Pool(databaseConfig)
    const client = await pool.connect()
    
    try {
      console.log('🗑️  Dropping existing announcement objects...')
      
      // Drop all announcement-related objects in correct order
      const dropQueries = [
        // Drop triggers first
        'DROP TRIGGER IF EXISTS announcements_notify_trigger ON public.announcements;',
        
        // Drop functions
        'DROP FUNCTION IF EXISTS notify_announcement_change();',
        'DROP FUNCTION IF EXISTS send_announcement(int4);',
        'DROP FUNCTION IF EXISTS get_user_announcements(int4);',
        'DROP FUNCTION IF EXISTS create_announcement_assignments(int4);',
        'DROP FUNCTION IF EXISTS process_scheduled_announcements();',
        'DROP FUNCTION IF EXISTS create_simple_announcement(varchar, text, _int4, int4, announcement_priority_enum);',
        'DROP FUNCTION IF EXISTS create_scheduled_announcement(varchar, text, timestamptz, int4, _int4, timestamptz, announcement_priority_enum);',
        
        // Drop tables (cascade will handle foreign keys)
        'DROP TABLE IF EXISTS public.announcement_assignments CASCADE;',
        'DROP TABLE IF EXISTS public.announcements CASCADE;',
        
        // Drop enums
        'DROP TYPE IF EXISTS public."announcement_status_enum" CASCADE;',
        'DROP TYPE IF EXISTS public."announcement_priority_enum" CASCADE;',
        'DROP TYPE IF EXISTS public."announcement_type_enum" CASCADE;',
      ]
      
      for (const query of dropQueries) {
        try {
          await client.query(query)
          console.log(`✅ Executed: ${query.split(' ')[0]} ${query.split(' ')[1]}`)
        } catch (error) {
          console.log(`⚠️  Warning: ${error.message}`)
        }
      }
      
      console.log('\n📋 Creating fresh announcements schema...')
      
      // Read and execute the complete schema
      const schemaPath = path.join(__dirname, '..', 'migrations', 'announcements_complete_schema.sql')
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8')
      
      await client.query(schemaSQL)
      
      console.log('✅ Announcements schema reset and recreated successfully!')
      console.log('📋 Schema includes:')
      console.log('   - announcements table (simplified, no announcement_type)')
      console.log('   - announcement_assignments table (simplified, no timestamps)')
      console.log('   - All necessary functions and triggers')
      console.log('   - Proper indexes and constraints')
      
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('❌ Schema reset failed:', error)
    process.exit(1)
  } finally {
    if (pool) await pool.end()
  }
}

resetAnnouncementsSchema()
