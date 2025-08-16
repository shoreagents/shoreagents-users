const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function setupSupabaseUsers() {
  try {
    console.log('🔍 Checking users in Railway database...\n');
    
    // Get users from Railway database
    const usersResult = await pool.query('SELECT id, email, user_type FROM users WHERE user_type = \'Agent\' ORDER BY created_at DESC');
    
    if (usersResult.rows.length === 0) {
      console.log('❌ No Agent users found in Railway database');
      return;
    }
    
    console.log('📋 Agent users in Railway database:');
    usersResult.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (ID: ${user.id})`);
    });
    
    console.log('\n🔍 Checking if users exist in Supabase...\n');
    
    for (const user of usersResult.rows) {
      try {
        // Try to get user from Supabase
        const { data: supabaseUser, error } = await supabaseAdmin?.auth.admin.getUserByEmail(user.email);
        
        if (error) {
          console.log(`❌ User ${user.email} not found in Supabase`);
          console.log(`   Error: ${error.message}`);
          
          if (supabaseAdmin) {
            console.log(`   Creating user ${user.email} in Supabase...`);
            
            // Create user in Supabase with a temporary password
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
              email: user.email,
              password: 'TempPassword123!', // Temporary password
              email_confirm: true, // Auto-confirm email
              user_metadata: {
                railway_user_id: user.id,
                user_type: user.user_type
              }
            });
            
            if (createError) {
              console.log(`   ❌ Failed to create user: ${createError.message}`);
            } else {
              console.log(`   ✅ Successfully created user ${user.email} in Supabase`);
              console.log(`   📧 User can now use password reset functionality`);
            }
          } else {
            console.log(`   ⚠️  Cannot create user - Supabase service key not available`);
          }
        } else {
          console.log(`✅ User ${user.email} already exists in Supabase`);
        }
        
        console.log(''); // Empty line for readability
        
      } catch (err) {
        console.log(`❌ Error checking user ${user.email}:`, err.message);
      }
    }
    
    console.log('💡 Next steps:');
    console.log('   1. Users can now request password reset via /forgot-password');
    console.log('   2. They will receive an email with a reset link');
    console.log('   3. They can set a new password via /reset-password');
    
  } catch (error) {
    console.error('❌ Error setting up Supabase users:', error);
  } finally {
    await pool.end();
  }
}

setupSupabaseUsers(); 