// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function checkSupabaseUser() {
  try {
    console.log('🔍 Checking user in Supabase...\n');
    
    if (!supabaseAdmin) {
      console.log('❌ Supabase service key not available');
      return;
    }
    
    const email = 'kyle.p@shoreagents.com';
    
    console.log(`📧 Checking user: ${email}`);
    
    // List all users to find the one we want
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.log('❌ Error listing users:', error.message);
    } else {
      const user = users.users.find(u => u.email === email);
      
      if (user) {
        console.log('✅ User found in Supabase:');
        console.log(`   User ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Email Confirmed: ${user.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
        console.log(`   User Metadata:`, user.user_metadata);
      } else {
        console.log('❌ User not found in Supabase');
      }
    }
    
    // Test if we can send a password reset
    console.log('\n🧪 Testing password reset...');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/reset-password'
    });
    
    if (resetError) {
      console.log('❌ Password reset error:', resetError.message);
      
      // Try to get more details about the error
      if (resetError.message.includes('Invalid email')) {
        console.log('💡 This usually means:');
        console.log('   1. Email is not confirmed');
        console.log('   2. Email provider is not configured');
        console.log('   3. User was deleted but not properly');
      }
    } else {
      console.log('✅ Password reset email sent successfully');
    }
    
    // Check if email provider is configured
    console.log('\n📧 Checking email configuration...');
    console.log(`✅ Found ${users?.users?.length || 0} users in Supabase`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSupabaseUser(); 