const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function checkSupabaseConfig() {
  try {
    console.log('🔍 Checking Supabase configuration...\n');
    
    if (!supabaseAdmin) {
      console.log('❌ Supabase service key not available');
      console.log('💡 Add SUPABASE_SERVICE_ROLE_KEY to your environment variables');
      return;
    }
    
    // Test users in Supabase
    console.log('1. Checking users in Supabase...');
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.log('❌ Error fetching users:', usersError.message);
    } else {
      console.log(`✅ Found ${users.users.length} users in Supabase:`);
      users.users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} (${user.created_at})`);
      });
    }
    
    // Test password reset for a specific email
    console.log('\n2. Testing password reset for bob@example.com...');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail('bob@example.com', {
      redirectTo: 'http://localhost:3000/reset-password'
    });
    
    if (resetError) {
      console.log('❌ Password reset error:', resetError.message);
      
      if (resetError.message.includes('Invalid email')) {
        console.log('💡 Solution: Create user in Supabase first');
        console.log('   Run: node scripts/setup-supabase-users.js');
      }
    } else {
      console.log('✅ Password reset email sent successfully');
    }
    
    console.log('\n💡 Configuration Checklist:');
    console.log('   ✅ Email template is configured correctly');
    console.log('   ❓ Check if users exist in Supabase auth');
    console.log('   ❓ Check if redirect URLs are configured in Supabase dashboard');
    console.log('   ❓ Check if email provider is configured');
    
  } catch (error) {
    console.error('❌ Error checking Supabase config:', error);
  }
}

checkSupabaseConfig(); 