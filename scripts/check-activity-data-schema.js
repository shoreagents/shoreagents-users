const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkActivityDataSchema() {
  console.log('🔍 Checking Activity Data Table Schema\n');
  
  try {
    // Check the table structure
    const tableInfo = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'activity_data' 
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Table Structure:');
    tableInfo.rows.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check a sample row to see the actual data
    console.log('\n📋 Sample Data:');
    const sampleData = await pool.query(`
      SELECT 
        id,
        user_id,
        today_date,
        today_active_seconds,
        today_inactive_seconds,
        created_at,
        updated_at
      FROM activity_data 
      ORDER BY created_at DESC 
      LIMIT 3
    `);
    
    sampleData.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ID: ${row.id}`);
      console.log(`      • today_date: ${row.today_date} (type: ${typeof row.today_date})`);
      console.log(`      • today_active_seconds: ${row.today_active_seconds}`);
      console.log(`      • today_inactive_seconds: ${row.today_inactive_seconds}`);
      console.log(`      • created_at: ${row.created_at}`);
      console.log('');
    });
    
    // Test the problematic query
    console.log('🧪 Testing the problematic query...');
    try {
      const testQuery = await pool.query(`
        SELECT COUNT(*) as count
        FROM activity_data 
        WHERE today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date
      `);
      console.log(`✅ Query successful: ${testQuery.rows[0].count} rows found`);
    } catch (error) {
      console.log(`❌ Query failed: ${error.message}`);
    }
    
    // Test with text casting
    console.log('\n🧪 Testing with text casting...');
    try {
      const testQuery2 = await pool.query(`
        SELECT COUNT(*) as count
        FROM activity_data 
        WHERE today_date = (NOW() AT TIME ZONE 'Asia/Manila')::date::text
      `);
      console.log(`✅ Query with text casting successful: ${testQuery2.rows[0].count} rows found`);
    } catch (error) {
      console.log(`❌ Query with text casting failed: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await pool.end();
  }
}

checkActivityDataSchema();
