#!/usr/bin/env node

/**
 * Break Sessions Seeding Script for ShoreAgents
 * This script populates the break_sessions table with sample historical data
 * Updated to work with comprehensive DDL schema
 */

const { Pool } = require('pg');

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Helper function to generate random break sessions for the past week
function generateSampleBreaks(agentUserId, days = 7) {
  const breaks = [];
  const breakTypes = ['Morning', 'Lunch', 'Afternoon']; // Capitalized as per DDL
  const today = new Date();
  
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Skip weekends for more realistic data
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    
    breakTypes.forEach((breakType, index) => {
      // Not every agent takes every break every day
      if (Math.random() > 0.8) return;
      
      let startHour, duration;
      
      switch (breakType) {
        case 'Morning':
          startHour = 10 + Math.random() * 1; // 10:00-11:00 AM
          duration = 10 + Math.random() * 10; // 10-20 minutes
          break;
        case 'Lunch':
          startHour = 12 + Math.random() * 2; // 12:00-2:00 PM
          duration = 30 + Math.random() * 30; // 30-60 minutes
          break;
        case 'Afternoon':
          startHour = 15 + Math.random() * 1; // 3:00-4:00 PM
          duration = 10 + Math.random() * 15; // 10-25 minutes
          break;
      }
      
      const startTime = new Date(date);
      startTime.setHours(Math.floor(startHour), Math.floor((startHour % 1) * 60), 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + Math.floor(duration));
      
      breaks.push({
        agent_user_id: agentUserId,
        break_type: breakType,
        start_time: startTime,
        end_time: endTime
      });
    });
  }
  
  return breaks;
}

async function seedBreaks() {
  let pool;
  
  try {
    console.log('☕ Starting break sessions seeding...\n');

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Create connection pool
    pool = new Pool(databaseConfig);
    
    // Test connection
    console.log('🔗 Testing database connection...');
    const testClient = await pool.connect();
    await testClient.query('SELECT NOW()');
    testClient.release();
    console.log('✅ Database connection successful\n');

    const client = await pool.connect();
    
    try {
      // Check if required tables exist
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('break_sessions', 'agents', 'users')
      `;
      
      const tablesResult = await client.query(tablesQuery);
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      if (!existingTables.includes('break_sessions')) {
        console.log('❌ Missing break_sessions table. Please run the break management schema migration first.');
        console.log('File: migrations/005_break_management_schema.sql');
        return;
      }

      if (!existingTables.includes('agents')) {
        console.log('❌ Missing agents table. Please run the comprehensive schema migration first.');
        console.log('File: migrations/003_comprehensive_schema.sql');
        return;
      }
      
      console.log('✅ Required tables exist\n');

      // Get all agents to create break sessions for
      const agentsQuery = `
        SELECT 
          a.user_id,
          u.email,
          pi.first_name,
          pi.last_name
        FROM agents a
        JOIN users u ON a.user_id = u.id
        LEFT JOIN personal_info pi ON u.id = pi.user_id
        ORDER BY a.user_id
      `;
      const agentsResult = await client.query(agentsQuery);
      
      if (agentsResult.rows.length === 0) {
        console.log('❌ No agents found. Please seed agents first.');
        console.log('Run: npm run seed-db-full');
        return;
      }

      console.log(`👥 Found ${agentsResult.rows.length} agents\n`);

      // Generate and seed break sessions for each agent
      console.log('☕ Seeding break sessions...');
      let totalBreaks = 0;
      
      for (const agent of agentsResult.rows) {
        const agentName = agent.first_name && agent.last_name 
          ? `${agent.first_name} ${agent.last_name}` 
          : agent.email;
        console.log(`  Processing breaks for: ${agentName}`);
        
        // Generate sample breaks for the past week
        const breaks = generateSampleBreaks(agent.user_id, 7);
        
        for (const breakData of breaks) {
          // Check if similar break already exists (avoid duplicates)
          const existingBreakQuery = `
            SELECT id FROM break_sessions 
            WHERE agent_user_id = $1 
            AND break_type = $2 
            AND DATE(start_time) = DATE($3)
          `;
          const existingBreakResult = await client.query(existingBreakQuery, [
            breakData.agent_user_id,
            breakData.break_type,
            breakData.start_time
          ]);
          
          if (existingBreakResult.rows.length > 0) {
            continue; // Skip if similar break exists
          }

          // Insert break session
          const insertBreakQuery = `
            INSERT INTO break_sessions (
              agent_user_id, break_type, start_time, end_time
            ) 
            VALUES ($1, $2::break_type_enum, $3, $4)
          `;
          
          await client.query(insertBreakQuery, [
            breakData.agent_user_id,
            breakData.break_type,
            breakData.start_time,
            breakData.end_time
          ]);
          
          totalBreaks++;
        }
        
        console.log(`  ✅ Created ${breaks.length} break sessions for ${agentName}`);
      }
      
      console.log('\n🎉 Break sessions seeding completed successfully!');
      console.log(`\n📊 Summary:`);
      console.log(`  - Total break sessions created: ${totalBreaks}`);
      console.log(`  - Agents with break data: ${agentsResult.rows.length}`);
      console.log(`  - Date range: Past 7 days (weekdays only)`);
      
      // Show break type distribution
      const statsQuery = `
        SELECT 
          break_type,
          COUNT(*) as count,
          ROUND(AVG(duration_minutes)::numeric, 1) as avg_duration
        FROM break_sessions 
        GROUP BY break_type 
        ORDER BY break_type
      `;
      const statsResult = await client.query(statsQuery);
      
      console.log('\n📈 Break type statistics:');
      statsResult.rows.forEach(stat => {
        console.log(`  - ${stat.break_type}: ${stat.count} sessions, avg ${stat.avg_duration} minutes`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Break sessions seeding failed:', error);
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('💡 Hint: Please create the comprehensive schema first');
      console.error('    Run: migrations/003_comprehensive_schema.sql and migrations/005_break_management_schema.sql');
    }
    
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the seeding script
if (require.main === module) {
  seedBreaks()
    .then(() => {
      console.log('\n✨ Break sessions seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { seedBreaks }; 