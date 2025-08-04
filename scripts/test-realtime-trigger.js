const { Pool } = require('pg');

const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

async function testRealtimeTrigger() {
  const pool = new Pool(databaseConfig);
  
  try {
    console.log('🔍 Testing real-time trigger...');
    
    // First, check if the trigger exists
    const triggerCheck = await pool.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_name = 'notify_activity_data_change'
    `);
    
    if (triggerCheck.rows.length === 0) {
      console.log('❌ Trigger not found! Running migration...');
      // Run the migration
      const fs = require('fs');
      const migrationPath = './migrations/010_activity_data_schema.sql';
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      await pool.query(migrationSQL);
      console.log('✅ Migration applied');
    } else {
      console.log('✅ Trigger exists');
    }
    
    // Get a test user
    const userResult = await pool.query('SELECT id, email FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const testUser = userResult.rows[0];
    console.log('👤 Using test user:', testUser.email);
    
    // Set up a listener
    const client = new Pool(databaseConfig);
    await client.connect();
    await client.query('LISTEN activity_change');
    
    console.log('👂 Listening for notifications...');
    
    // Set up notification handler
    client.on('notification', (msg) => {
      console.log('🔔 Received notification:', msg);
      try {
        const data = JSON.parse(msg.payload);
        console.log('📦 Parsed data:', data);
      } catch (error) {
        console.log('❌ Failed to parse notification:', error);
      }
    });
    
    // Wait a moment, then trigger an update
    setTimeout(async () => {
      console.log('🔄 Triggering database update...');
      
      // Update the user's activity status
      const updateResult = await pool.query(
        'UPDATE activity_data SET is_currently_active = NOT is_currently_active WHERE user_id = $1 RETURNING *',
        [testUser.id]
      );
      
      if (updateResult.rows.length > 0) {
        console.log('✅ Database updated:', updateResult.rows[0]);
      } else {
        console.log('❌ No activity_data record found, creating one...');
        await pool.query(
          'INSERT INTO activity_data (user_id, is_currently_active) VALUES ($1, $2)',
          [testUser.id, true]
        );
        console.log('✅ Created activity_data record');
      }
      
      // Wait a bit more to see if notification arrives
      setTimeout(() => {
        console.log('🏁 Test complete');
        client.end();
        pool.end();
        process.exit(0);
      }, 2000);
      
    }, 1000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    pool.end();
    process.exit(1);
  }
}

testRealtimeTrigger(); 