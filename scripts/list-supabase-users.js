// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function listSupabaseUsers() {
  try {
    console.log('🔍 Listing users in Supabase...\n');
    
    if (!supabaseAdmin) {
      console.log('❌ Supabase service key not available');
      return;
    }
    
    // List all users
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.log('❌ Error listing users:', error.message);
    } else {
      console.log(`✅ Found ${users.users.length} users in Supabase:\n`);
      
      users.users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Confirmed: ${user.email_confirmed_at ? '✅' : '❌'}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listSupabaseUsers(); 