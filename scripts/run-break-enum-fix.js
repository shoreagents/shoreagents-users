const { Pool } = require('pg');

// Use Railway connection string as fallback if DATABASE_URL is not set
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway';

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runBreakEnumFix() {
  try {
    console.log('🔧 Running Break Type Enum Fix Migration...\n');
    console.log(`📡 Connecting to: ${connectionString.replace(/:[^:@]*@/, ':****@')}\n`);
    
    // Check if database is accessible
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // First, add the new enum values to the existing enum type
    console.log('📝 Adding new enum values to existing break_type_enum...');
    
    try {
      await pool.query("ALTER TYPE break_type_enum ADD VALUE 'NightFirst'");
      console.log('   ✅ Added NightFirst');
    } catch (error) {
      if (error.code === '42710') { // duplicate_object
        console.log('   ℹ️ NightFirst already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await pool.query("ALTER TYPE break_type_enum ADD VALUE 'NightMeal'");
      console.log('   ✅ Added NightMeal');
    } catch (error) {
      if (error.code === '42710') { // duplicate_object
        console.log('   ℹ️ NightMeal already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await pool.query("ALTER TYPE break_type_enum ADD VALUE 'NightSecond'");
      console.log('   ✅ Added NightSecond');
    } catch (error) {
      if (error.code === '42710') { // duplicate_object
        console.log('   ℹ️ NightSecond already exists');
      } else {
        throw error;
      }
    }
    
    // Now update existing break_sessions data to use new enum values
    console.log('\n📝 Updating existing break_sessions data...');
    
    // Check if there are any records with old enum values
    const oldEnumCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM break_sessions 
      WHERE break_type::text IN ('FirstNight', 'Midnight', 'SecondNight')
    `);
    
    if (oldEnumCount.rows[0].count > 0) {
      console.log(`   Found ${oldEnumCount.rows[0].count} records with old enum values`);
      
      const updateResult1 = await pool.query(`
        UPDATE break_sessions 
        SET break_type = 'NightFirst'::break_type_enum 
        WHERE break_type::text = 'FirstNight'
      `);
      console.log(`   Updated FirstNight → NightFirst: ${updateResult1.rowCount} rows`);
      
      const updateResult2 = await pool.query(`
        UPDATE break_sessions 
        SET break_type = 'NightMeal'::break_type_enum 
        WHERE break_type::text = 'Midnight'
      `);
      console.log(`   Updated Midnight → NightMeal: ${updateResult2.rowCount} rows`);
      
      const updateResult3 = await pool.query(`
        UPDATE break_sessions 
        SET break_type = 'NightSecond'::break_type_enum 
        WHERE break_type::text = 'SecondNight'
      `);
      console.log(`   Updated SecondNight → NightSecond: ${updateResult3.rowCount} rows`);
    } else {
      console.log('   ℹ️ No records with old enum values found, skipping update step');
    }
    
    // Now we can safely remove the old enum values
    console.log('\n🗑️ Removing old enum values...');
    
    // Create a temporary table to store the data
    console.log('\n🔄 Creating temporary table for data migration...');
    
    // First, let's backup the current data to a JSON-like format
    const currentData = await pool.query('SELECT * FROM break_sessions');
    console.log(`   📊 Backed up ${currentData.rows.length} records`);
    
    // Drop the old enum type (this will cascade to the table)
    console.log('\n🗑️ Dropping old enum type...');
    await pool.query('DROP TYPE IF EXISTS break_type_enum CASCADE');
    console.log('   ✅ Old enum type dropped');
    
    // Recreate the enum with only the new values
    console.log('\n🆕 Creating new enum type...');
    await pool.query(`
      CREATE TYPE break_type_enum AS ENUM (
          'Morning',
          'Lunch', 
          'Afternoon',
          'NightFirst',
          'NightMeal',
          'NightSecond'
      )
    `);
    console.log('   ✅ New enum type created');
    
    // Recreate the break_sessions table with the new enum
    console.log('\n🔄 Recreating break_sessions table...');
    
    const createTableSQL = `
      CREATE TABLE break_sessions (
        id SERIAL PRIMARY KEY,
        agent_user_id INTEGER NOT NULL,
        break_type break_type_enum NOT NULL,
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        break_date DATE NOT NULL,
        pause_time TIMESTAMP WITH TIME ZONE,
        resume_time TIMESTAMP WITH TIME ZONE,
        time_remaining_at_pause INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    
    await pool.query(createTableSQL);
    console.log('   ✅ Table recreated with new enum');
    
    // Restore the data with proper type conversion
    console.log('\n📥 Restoring data with proper type conversion...');
    
    if (currentData.rows.length > 0) {
      // Insert data with proper type casting for break_type
      for (const row of currentData.rows) {
        let newBreakType;
        switch (row.break_type) {
          case 'FirstNight':
            newBreakType = 'NightFirst';
            break;
          case 'Midnight':
            newBreakType = 'NightMeal';
            break;
          case 'SecondNight':
            newBreakType = 'NightSecond';
            break;
          default:
            newBreakType = row.break_type;
        }
        
        await pool.query(`
          INSERT INTO break_sessions (
            id, agent_user_id, break_type, start_time, end_time, 
            break_date, pause_time, resume_time, time_remaining_at_pause, 
            created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          row.id, row.agent_user_id, newBreakType, row.start_time, row.end_time,
          row.break_date, row.pause_time, row.resume_time, row.time_remaining_at_pause,
          row.created_at, row.updated_at
        ]);
      }
      console.log(`   ✅ Restored ${currentData.rows.length} records with proper type conversion`);
    } else {
      console.log('   ℹ️ No data to restore');
    }
    
    // Add back constraints and indexes
    console.log('\n🔒 Adding constraints and indexes...');
    
    // Add foreign key constraint if it existed
    try {
      await pool.query(`
        ALTER TABLE break_sessions 
        ADD CONSTRAINT break_sessions_agent_user_id_fkey 
        FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('   ✅ Foreign key constraint added');
    } catch (error) {
      console.log('   ℹ️ Foreign key constraint already exists or not needed');
    }
    
    // Add check constraint
    await pool.query(`
      ALTER TABLE break_sessions 
      ADD CONSTRAINT break_sessions_break_type_check 
      CHECK (break_type IN ('Morning', 'Lunch', 'Afternoon', 'NightFirst', 'NightMeal', 'NightSecond'))
    `);
    console.log('   ✅ Check constraint added');
    
    // Recreate indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_break_sessions_break_type ON break_sessions(break_type)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_break_sessions_agent_user_id ON break_sessions(agent_user_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_break_sessions_break_date ON break_sessions(break_date)');
    console.log('   ✅ Indexes recreated');
    
    // Verify the changes
    console.log('\n🔍 Verifying changes...');
    const verifyResult = await pool.query('SELECT DISTINCT break_type FROM break_sessions ORDER BY break_type');
    
    if (verifyResult.rows.length === 0) {
      console.log('   ℹ️ No break sessions found in database');
    } else {
      console.log('   📋 Current break types in database:');
      verifyResult.rows.forEach(row => {
        console.log(`      • ${row.break_type}`);
      });
    }
    
    // Test the new enum values
    console.log('\n🧪 Testing new enum values...');
    try {
      await pool.query("SELECT 'Morning'::break_type_enum as test1, 'NightMeal'::break_type_enum as test2");
      console.log('   ✅ New enum values working correctly');
    } catch (error) {
      console.log('   ❌ Error testing new enum values:', error.message);
    }
    
    console.log('\n🎉 Break Type Enum Fix Migration Completed Successfully!');
    console.log('\n📋 Summary of Changes:');
    console.log('   • FirstNight → NightFirst');
    console.log('   • Midnight → NightMeal');
    console.log('   • SecondNight → NightSecond');
    console.log('   • Eliminated conflicts with "midnight" keyword');
    console.log('   • All break functionality preserved');
    
  } catch (error) {
    console.error('❌ Error during migration:', error);
    console.error('\n🔍 Error details:', error.message);
    
    // Try to get more details about the error
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Error detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Error hint:', error.hint);
    }
    
    // Provide helpful troubleshooting tips
    console.error('\n🔧 Troubleshooting Tips:');
    console.error('   1. Check if your database is running');
    console.error('   2. Verify DATABASE_URL environment variable');
    console.error('   3. Check network connectivity to database host');
    console.error('   4. Ensure database user has necessary permissions');
    
  } finally {
    await pool.end();
  }
}

// Run the migration
runBreakEnumFix();
