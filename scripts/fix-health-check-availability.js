const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function fixHealthCheckAvailability() {
  const client = await pool.connect();
  try {
    console.log('🔧 Fixing Health Check Availability Data...\n');
    
    // 1. Clear existing data for nurse_id 1
    console.log('1️⃣ Clearing existing availability data for nurse_id 1...');
    await client.query('DELETE FROM health_check_availability WHERE nurse_id = 1');
    console.log('   ✅ Cleared existing data');
    
    // 2. Insert complete availability for all 7 days
    console.log('\n2️⃣ Inserting complete availability schedule...');
    
    const availability = [
      { day: 0, name: 'Sunday' },
      { day: 1, name: 'Monday' },
      { day: 2, name: 'Tuesday' },
      { day: 3, name: 'Wednesday' },
      { day: 4, name: 'Thursday' },
      { day: 5, name: 'Friday' },
      { day: 6, name: 'Saturday' }
    ];
    
    for (const day of availability) {
      await client.query(`
        INSERT INTO health_check_availability 
        (nurse_id, day_of_week, shift_start, shift_end, is_available, break_start, break_end)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [1, day.day, '06:00:00', '15:00:00', true, '10:00:00', '10:15:00']);
      
      console.log(`   ✅ Added ${day.name} (day ${day.day})`);
    }
    
    // 3. Verify the data
    console.log('\n3️⃣ Verifying availability data...');
    
    const result = await client.query(`
      SELECT hca.*, 
             u.email as nurse_email,
             u.user_type as nurse_role
      FROM health_check_availability hca
      LEFT JOIN users u ON hca.nurse_id = u.id
      WHERE u.user_type = 'Internal'
      ORDER BY hca.nurse_id, hca.day_of_week
    `);
    
    console.log(`   Found ${result.rows.length} availability records:`);
    result.rows.forEach((row, index) => {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      console.log(`     ${index + 1}. ${dayNames[row.day_of_week]}: ${row.shift_start} - ${row.shift_end} (Available: ${row.is_available})`);
    });
    
    console.log('\n🎉 Health Check Availability Fixed Successfully!');
    
  } catch (error) {
    console.error('\n❌ Error fixing availability:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the fix
fixHealthCheckAvailability();
