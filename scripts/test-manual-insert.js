const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testManualInsert() {
  console.log('🧪 Testing Manual Row Insertion\n');
  
  try {
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0];
    
    console.log(`📅 Testing insertion for date: ${tomorrowDate}`);
    
    // Step 1: Check if row already exists
    console.log('\n📋 Step 1: Checking if row already exists...');
    const existingCheck = await pool.query(`
      SELECT id, user_id, today_date 
      FROM activity_data 
      WHERE user_id = 2 AND today_date = $1
    `, [tomorrowDate]);
    
    if (existingCheck.rows.length > 0) {
      console.log(`⚠️ Row already exists: ID ${existingCheck.rows[0].id}`);
      return;
    }
    
    console.log('✅ No existing row found - proceeding with test insert');
    
    // Step 2: Try to manually insert a row
    console.log('\n📋 Step 2: Attempting manual insert...');
    try {
      const insertResult = await pool.query(`
        INSERT INTO activity_data (
          user_id, is_currently_active, today_active_seconds, 
          today_inactive_seconds, today_date, last_session_start
        ) VALUES ($1, false, 0, 0, $2, NOW())
        RETURNING id, user_id, today_date, created_at
      `, [2, tomorrowDate]);
      
      if (insertResult.rows.length > 0) {
        const newRow = insertResult.rows[0];
        console.log('✅ Manual insert successful!');
        console.log(`   • New ID: ${newRow.id}`);
        console.log(`   • User ID: ${newRow.user_id}`);
        console.log(`   • Date: ${newRow.today_date}`);
        console.log(`   • Created: ${newRow.created_at}`);
        
        // Clean up the test row
        console.log('\n🧹 Cleaning up test row...');
        await pool.query(`
          DELETE FROM activity_data 
          WHERE id = $1
        `, [newRow.id]);
        console.log('✅ Test row cleaned up');
        
      } else {
        console.log('❌ Insert returned no rows');
      }
      
    } catch (insertError) {
      console.error('❌ Manual insert failed:', insertError.message);
      console.error('   Error code:', insertError.code);
      console.error('   Error detail:', insertError.detail);
    }
    
    // Step 3: Check table constraints
    console.log('\n📋 Step 3: Checking table constraints...');
    try {
      const constraintCheck = await pool.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        LEFT JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'activity_data'
        ORDER BY tc.constraint_type, tc.constraint_name
      `);
      
      console.log(`📊 Found ${constraintCheck.rows.length} constraints:`);
      constraintCheck.rows.forEach((constraint, index) => {
        console.log(`   ${index + 1}. ${constraint.constraint_type}: ${constraint.constraint_name}`);
        if (constraint.column_name) {
          console.log(`      Column: ${constraint.column_name}`);
        }
        if (constraint.foreign_table_name) {
          console.log(`      References: ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
        }
      });
      
    } catch (constraintError) {
      console.error('❌ Constraint check failed:', constraintError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await pool.end();
  }
}

testManualInsert();
