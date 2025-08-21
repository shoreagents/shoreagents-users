const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkTimezoneSettings() {
  console.log('🔍 Checking Database vs Application Timezone Settings\n');
  
  try {
    // 1. Check database timezone settings
    console.log('1️⃣ Database Timezone Settings:');
    const timezoneResult = await pool.query(`
      SELECT 
        current_setting('timezone') as db_timezone,
        current_setting('log_timezone') as log_timezone,
        NOW() as db_current_time,
        NOW() AT TIME ZONE 'UTC' as db_utc_time,
        NOW() AT TIME ZONE 'Asia/Manila' as db_manila_time,
        NOW() AT TIME ZONE 'Asia/Singapore' as db_singapore_time,
        EXTRACT(timezone FROM NOW()) as timezone_offset_seconds
    `);
    
    const tz = timezoneResult.rows[0];
    console.log(`   • Database timezone: ${tz.db_timezone}`);
    console.log(`   • Log timezone: ${tz.log_timezone}`);
    console.log(`   • Database current time: ${tz.db_current_time}`);
    console.log(`   • Database UTC time: ${tz.db_utc_time}`);
    console.log(`   • Database Manila time: ${tz.db_manila_time}`);
    console.log(`   • Database Singapore time: ${tz.db_singapore_time}`);
    console.log(`   • Timezone offset: ${tz.timezone_offset_seconds} seconds`);
    
    // 2. Check application timezone expectations
    console.log('\n2️⃣ Application Timezone Expectations:');
    const appTime = new Date();
    console.log(`   • Application current time: ${appTime.toISOString()}`);
    console.log(`   • Application local time: ${appTime.toString()}`);
    console.log(`   • Application timezone offset: ${appTime.getTimezoneOffset()} minutes`);
    
    // 3. Check if database functions are using correct timezone
    console.log('\n3️⃣ Database Function Timezone Usage:');
    const functionTzResult = await pool.query(`
      SELECT 
        NOW() as function_now,
        NOW() AT TIME ZONE 'Asia/Manila' as function_manila,
        NOW() AT TIME ZONE 'Asia/Singapore' as function_singapore
    `);
    
    const funcTz = functionTzResult.rows[0];
    console.log(`   • Function NOW(): ${funcTz.function_now}`);
    console.log(`   • Function Manila time: ${funcTz.function_manila}`);
    console.log(`   • Function Singapore time: ${funcTz.function_singapore}`);
    
    // 4. Check timezone functions in database
    console.log('\n4️⃣ Timezone Functions Available:');
    const tzFunctionsResult = await pool.query(`
      SELECT proname, prosrc 
      FROM pg_proc 
      WHERE prosrc LIKE '%timezone%' OR prosrc LIKE '%Asia/Manila%' OR prosrc LIKE '%Asia/Singapore%'
      LIMIT 10
    `);
    
    if (tzFunctionsResult.rows.length > 0) {
      console.log(`   • Found ${tzFunctionsResult.rows.length} functions with timezone logic:`);
      tzFunctionsResult.rows.forEach((func, index) => {
        console.log(`     ${index + 1}. ${func.proname}`);
      });
    } else {
      console.log('   • No timezone-specific functions found');
    }
    
    // 5. Summary and recommendations
    console.log('\n📋 Timezone Analysis Summary:');
    const dbOffsetHours = tz.timezone_offset_seconds / 3600;
    const appOffsetHours = -appTime.getTimezoneOffset() / 60;
    
    console.log(`   • Database offset: ${dbOffsetHours} hours`);
    console.log(`   • Application offset: ${appOffsetHours} hours`);
    
    if (Math.abs(dbOffsetHours - appOffsetHours) > 0.1) {
      console.log('   ⚠️  TIMEZONE MISMATCH DETECTED!');
      console.log('   ⚠️  Database and application are using different timezones');
    } else {
      console.log('   ✅ Database and application timezones are aligned');
    }
    
    // Check if Manila timezone is being used correctly
    if (tz.db_manila_time && tz.db_current_time) {
      const manilaDiff = Math.abs(new Date(tz.db_manila_time) - new Date(tz.db_current_time));
      if (manilaDiff > 60000) { // More than 1 minute difference
        console.log('   ⚠️  Manila timezone conversion may be incorrect');
      } else {
        console.log('   ✅ Manila timezone conversion working correctly');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking timezone settings:', error.message);
  } finally {
    await pool.end();
  }
}

checkTimezoneSettings();
