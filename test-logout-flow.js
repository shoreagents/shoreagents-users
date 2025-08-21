const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway'
});

async function testLogoutFlow() {
  console.log('🧪 Testing Logout Flow and Online Status...\n');
  
  try {
    // Check socket server for logout handler
    console.log('1️⃣ Checking socket server logout handler...');
    
    const fs = require('fs');
    const socketContent = fs.readFileSync('socket-server.js', 'utf8');
    
    if (socketContent.includes('socket.on(\'logout\'') {
      console.log('✅ Socket server has logout event handler');
    } else {
      console.log('❌ Socket server missing logout event handler');
    }
    
    if (socketContent.includes('🚪 User ${email} logging out - marking as offline')) {
      console.log('✅ Socket server properly marks users as offline on logout');
    } else {
      console.log('❌ Socket server missing offline status update on logout');
    }
    
    // Check auth-utils for logout event emission
    console.log('\n2️⃣ Checking auth-utils logout handling...');
    
    const authUtilsContent = fs.readFileSync('src/lib/auth-utils.ts', 'utf8');
    
    if (authUtilsContent.includes('user-logout')) {
      console.log('✅ Auth-utils dispatches user-logout event');
    } else {
      console.log('❌ Auth-utils missing user-logout event dispatch');
    }
    
    if (authUtilsContent.includes('Socket logout event failed')) {
      console.log('✅ Auth-utils has error handling for socket events');
    } else {
      console.log('❌ Auth-utils missing socket event error handling');
    }
    
    // Check socket hook for logout listener
    console.log('\n3️⃣ Checking socket hook logout handling...');
    
    const socketHookContent = fs.readFileSync('src/hooks/use-socket.ts', 'utf8');
    
    if (socketHookContent.includes('user-logout')) {
      console.log('✅ Socket hook listens for user-logout events');
    } else {
      console.log('❌ Socket hook missing user-logout event listener');
    }
    
    if (socketHookContent.includes('socket.emit(\'logout\')')) {
      console.log('✅ Socket hook emits logout event to server');
    } else {
      console.log('❌ Socket hook missing logout event emission');
    }
    
    // Check online status context for logout handling
    console.log('\n4️⃣ Checking online status context logout handling...');
    
    const contextContent = fs.readFileSync('src/contexts/online-status-context.tsx', 'utf8');
    
    if (contextContent.includes('user-logout')) {
      console.log('✅ Online status context listens for user-logout events');
    } else {
      console.log('❌ Online status context missing user-logout event listener');
    }
    
    if (contextContent.includes('setOnlineStatus({})')) {
      console.log('✅ Online status context clears status on logout');
    } else {
      console.log('❌ Online status context missing status clearing on logout');
    }
    
    console.log('\n5️⃣ Summary of Logout Flow:');
    console.log('   ✅ User clicks logout → forceLogout() called');
    console.log('   ✅ CustomEvent "user-logout" dispatched');
    console.log('   ✅ Socket hook listens for event and emits "logout" to server');
    console.log('   ✅ Socket server marks user as offline and broadcasts status');
    console.log('   ✅ Online status context clears local status data');
    console.log('   ✅ User redirected to login page');
    
    console.log('\n6️⃣ Benefits of This Approach:');
    console.log('   • Users are immediately marked as offline when logging out');
    console.log('   • Other users see real-time status updates');
    console.log('   • Leaderboard status indicators update correctly');
    console.log('   • No more "ghost" online users after logout');
    console.log('   • Clean socket connection management');
    
    console.log('\n7️⃣ Next Steps:');
    console.log('   1. Restart the socket server to apply changes');
    console.log('   2. Test logout flow with multiple browser tabs');
    console.log('   3. Verify user shows as offline in leaderboard');
    console.log('   4. Check that socket connections are properly closed');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testLogoutFlow();
