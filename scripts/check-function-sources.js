const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function checkFunctionSources() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking function sources that call calculate_break_windows...\n');
    
    const functionsToCheck = [
      'is_break_available_soon',
      'is_break_available_now', 
      'is_break_window_ending_soon'
    ];
    
    for (const funcName of functionsToCheck) {
      console.log(`\n📋 Checking ${funcName} source code...`);
      
      const result = await client.query(`
        SELECT prosrc FROM pg_proc WHERE proname = $1
      `, [funcName]);
      
      if (result.rows.length > 0) {
        const source = result.rows[0].prosrc;
        console.log('   Function source:');
        
        // Look for lines that contain "calculate_break_windows"
        const lines = source.split('\n');
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes('calculate_break_windows')) {
            console.log(`     Line ${index + 1}: ${line.trim()}`);
          }
        });
        
        // Show first 20 lines to understand the structure
        console.log('\n   First 20 lines of function:');
        lines.slice(0, 20).forEach((line, index) => {
          console.log(`     ${index + 1}: ${line}`);
        });
        
        if (lines.length > 20) {
          console.log('     ... (truncated)');
        }
      } else {
        console.log(`   ❌ Function ${funcName} not found`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Error checking function sources:', error.message);
  } finally {
    await client.release();
    await pool.end();
  }
}

// Run the check
checkFunctionSources();
