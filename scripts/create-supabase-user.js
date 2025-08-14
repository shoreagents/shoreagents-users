// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('🔍 Checking Supabase configuration...');
console.log(`URL: ${supabaseUrl}`);
console.log(`Anon Key: ${supabaseAnonKey ? '✅ Set' : '❌ Missing'}`);
console.log(`Service Key: ${supabaseServiceKey ? '✅ Set' : '❌ Missing'}`);

if (!supabaseAnonKey) {
  console.log('\n❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  console.log('💡 Please add your Supabase keys to .env.local file');
  console.log('📝 Example .env.local:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://sanljwkkoawwdpaxrper.supabase.co');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

async function createSupabaseUser() {
  try {
    console.log('\n🔍 Creating user in Supabase...\n');
    
    if (!supabaseAdmin) {
      console.log('❌ Supabase service key not available');
      console.log('💡 Please add your SUPABASE_SERVICE_ROLE_KEY to .env.local');
      console.log('💡 You can get it from: https://supabase.com/dashboard/project/sanljwkkoawwdpaxrper/settings/api');
      return;
    }
    
    const email = 'bob@example.com';
    const password = 'TempPassword123!';
    
    console.log(`📧 Creating user: ${email}`);
    
    // Create user in Supabase
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        user_type: 'Agent',
        source: 'railway_migration'
      }
    });
    
    if (error) {
      console.log('❌ Error creating user:', error.message);
      
      if (error.message.includes('already registered')) {
        console.log('✅ User already exists in Supabase');
      }
    } else {
      console.log('✅ User created successfully in Supabase');
      console.log(`   User ID: ${user.user.id}`);
      console.log(`   Email: ${user.user.email}`);
    }
    
    // Test password reset
    console.log('\n🧪 Testing password reset...');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/reset-password'
    });
    
    if (resetError) {
      console.log('❌ Password reset error:', resetError.message);
    } else {
      console.log('✅ Password reset email sent successfully');
      console.log('📧 Check your email for the reset link');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createSupabaseUser(); 