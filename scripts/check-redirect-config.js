// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sanljwkkoawwdpaxrper.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRedirectConfig() {
  try {
    console.log('🔍 Checking redirect URL configuration...\n');
    
    const email = 'kyle.p@shoreagents.com';
    
    console.log(`📧 Testing password reset for: ${email}`);
    
    // Test with the exact redirect URL from your email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/reset-password'
    });
    
    if (resetError) {
      console.log('❌ Password reset error:', resetError.message);
      
      if (resetError.message.includes('redirect')) {
        console.log('\n💡 This error suggests redirect URLs are not configured properly.');
        console.log('🔧 Please configure redirect URLs in Supabase dashboard:');
        console.log('   1. Go to: https://supabase.com/dashboard/project/sanljwkkoawwdpaxrper/authentication/url-configuration');
        console.log(`   2. Add: ${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')}/reset-password`);
        console.log(`   3. Add: ${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')}`);
        console.log('   4. Save the changes');
      }
    } else {
      console.log('✅ Password reset email sent successfully');
      console.log('📧 Check your email for the reset link');
      console.log('\n💡 If the link still shows "invalid", try:');
      console.log(`   1. Use manual token entry at: ${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')}/reset-password`);
      console.log('   2. Copy the token from the email URL');
      console.log('   3. Paste it in the token field');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRedirectConfig(); 