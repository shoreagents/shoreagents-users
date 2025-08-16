require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:poEVEBPjHAzsGZwjIkBBEaRScUwhguoX@maglev.proxy.rlwy.net:41493/railway',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createSampleBreaks() {
  try {
    console.log('🧪 Creating sample break data...');
    
    // Test user ID
    const testUserId = 1;
    
    // Check if user exists
    const userCheckQuery = `
      SELECT u.id, u.email, pi.first_name, pi.last_name
      FROM users u
      LEFT JOIN personal_info pi ON u.id = pi.user_id
      WHERE u.id = $1
    `;
    
    const userResult = await pool.query(userCheckQuery, [testUserId]);
    
    if (userResult.rows.length === 0) {
      console.log('❌ Test user not found with ID:', testUserId);
      return;
    }
    
    const user = userResult.rows[0];
    console.log('✅ Test user found:', {
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
    });
    
    // Check if user exists in agents table
    const agentCheckQuery = `
      SELECT user_id FROM agents WHERE user_id = $1
    `;
    
    const agentResult = await pool.query(agentCheckQuery, [testUserId]);
    
    if (agentResult.rows.length === 0) {
      console.log('⚠️ User not found in agents table, creating agent record...');
      
      // Create agent record
      const createAgentQuery = `
        INSERT INTO agents (user_id, created_at) VALUES ($1, NOW())
      `;
      
      await pool.query(createAgentQuery, [testUserId]);
      console.log('✅ Created agent record for user ID:', testUserId);
    } else {
      console.log('✅ User already exists in agents table');
    }
    
    // Sample break data
    const sampleBreaks = [
      {
        break_type: 'Morning',
        start_time: '2025-08-05 09:30:00',
        end_time: '2025-08-05 09:45:00',
        duration_minutes: 15
      },
      {
        break_type: 'Lunch',
        start_time: '2025-08-05 12:00:00',
        end_time: '2025-08-05 13:00:00',
        duration_minutes: 60
      },
      {
        break_type: 'Afternoon',
        start_time: '2025-08-05 14:30:00',
        end_time: '2025-08-05 14:45:00',
        duration_minutes: 15
      },
      {
        break_type: 'Morning',
        start_time: '2025-08-04 09:15:00',
        end_time: '2025-08-04 09:30:00',
        duration_minutes: 15
      },
      {
        break_type: 'Lunch',
        start_time: '2025-08-04 12:30:00',
        end_time: '2025-08-04 13:30:00',
        duration_minutes: 60
      },
      {
        break_type: 'Morning',
        start_time: '2025-08-03 09:45:00',
        end_time: '2025-08-03 10:00:00',
        duration_minutes: 15
      },
      {
        break_type: 'Lunch',
        start_time: '2025-08-03 12:15:00',
        end_time: '2025-08-03 13:15:00',
        duration_minutes: 60
      }
    ];
    
    console.log('📊 Creating sample breaks...');
    
    for (const breakData of sampleBreaks) {
      const insertQuery = `
        INSERT INTO break_sessions (
          agent_user_id, 
          break_type, 
          start_time, 
          end_time, 
          duration_minutes, 
          created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await pool.query(insertQuery, [
        testUserId,
        breakData.break_type,
        breakData.start_time,
        breakData.end_time,
        breakData.duration_minutes
      ]);
      
      console.log(`✅ Created ${breakData.break_type} break: ${breakData.start_time} - ${breakData.end_time} (${breakData.duration_minutes}m)`);
    }
    
    // Calculate total time after creating sample data
    const totalBreakTimeQuery = `
      SELECT 
        SUM(duration_minutes) as total_break_time_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND end_time IS NOT NULL
    `;

    const totalBreakTimeResult = await pool.query(totalBreakTimeQuery, [testUserId]);
    const totalBreakTimeMinutes = totalBreakTimeResult[0]?.total_break_time_minutes || 0;
    
    console.log('\n✅ Sample break data created successfully!');
    console.log('Total break time:', {
      totalMinutes: totalBreakTimeMinutes,
      totalHours: Math.floor(totalBreakTimeMinutes / 60),
      remainingMinutes: totalBreakTimeMinutes % 60,
      formatted: totalBreakTimeMinutes >= 60 ? 
        `${Math.floor(totalBreakTimeMinutes / 60)}h ${totalBreakTimeMinutes % 60}m` : 
        `${totalBreakTimeMinutes}m`
    });
    
    // Show breakdown by type
    const statsQuery = `
      SELECT 
        break_type,
        COUNT(*) as total_sessions,
        SUM(duration_minutes) as total_minutes
      FROM break_sessions 
      WHERE agent_user_id = $1 
      AND end_time IS NOT NULL
      GROUP BY break_type
      ORDER BY break_type
    `;

    const statsResult = await pool.query(statsQuery, [testUserId]);
    
    console.log('\n📊 Breakdown by break type:');
    statsResult.rows.forEach(stat => {
      console.log(`  ${stat.break_type}: ${stat.total_sessions} sessions, ${stat.total_minutes || 0}m total`);
    });
    
  } catch (error) {
    console.error('❌ Error creating sample breaks:', error.message);
  } finally {
    await pool.end();
  }
}

createSampleBreaks(); 