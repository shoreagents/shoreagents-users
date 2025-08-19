const { Pool } = require('pg');

// Use Railway connection string as fallback if DATABASE_URL is not set
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway';

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkCurrentEnum() {
  try {
    console.log('🔍 Checking Current Break Type Enum Values...\n');
    console.log(`📡 Connecting to: ${connectionString.replace(/:[^:@]*@/, ':****@')}\n`);
    
    // Check if database is accessible
    await pool.query('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // Check if the enum type exists
    console.log('📋 Checking if break_type_enum exists...');
    const enumExists = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type 
        WHERE typname = 'break_type_enum'
      );
    `);
    
    if (enumExists.rows[0].exists) {
      console.log('   ✅ break_type_enum type exists');
      
      // Get current enum values
      const enumValues = await pool.query(`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'break_type_enum'
        )
        ORDER BY enumsortorder;
      `);
      
      console.log('\n📝 Current enum values:');
      if (enumValues.rows.length === 0) {
        console.log('   ℹ️ No values found in enum');
      } else {
        enumValues.rows.forEach((row, index) => {
          console.log(`   ${index + 1}. ${row.enumlabel}`);
        });
      }
      
      // Check if break_sessions table exists and has data
      console.log('\n📊 Checking break_sessions table...');
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'break_sessions'
        );
      `);
      
      if (tableExists.rows[0].exists) {
        console.log('   ✅ break_sessions table exists');
        
        // Check current break types in use
        const currentBreakTypes = await pool.query(`
          SELECT DISTINCT break_type, COUNT(*) as count
          FROM break_sessions 
          GROUP BY break_type 
          ORDER BY break_type;
        `);
        
        console.log('\n📈 Current break types in use:');
        if (currentBreakTypes.rows.length === 0) {
          console.log('   ℹ️ No break sessions found');
        } else {
          currentBreakTypes.rows.forEach(row => {
            console.log(`   • ${row.break_type}: ${row.count} sessions`);
          });
        }
      } else {
        console.log('   ❌ break_sessions table does not exist');
      }
      
    } else {
      console.log('   ❌ break_type_enum type does not exist');
      
      // Check if there are any similar types
      const similarTypes = await pool.query(`
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE '%break%' OR typname LIKE '%enum%';
      `);
      
      if (similarTypes.rows.length > 0) {
        console.log('\n🔍 Similar types found:');
        similarTypes.rows.forEach(row => {
          console.log(`   • ${row.typname}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking enum:', error);
    console.error('\n🔍 Error details:', error.message);
    
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    if (error.detail) {
      console.error('   Error detail:', error.detail);
    }
    if (error.hint) {
      console.error('   Error hint:', error.hint);
    }
  } finally {
    await pool.end();
  }
}

// Run the check
checkCurrentEnum();
