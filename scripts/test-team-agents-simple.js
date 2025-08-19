const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTeamAgentsSimple() {
  try {
    console.log('🧪 Testing Team Agents API - Simple Test...\n');
    
    // Test the exact query that the API will use
    console.log('📊 Testing the member_id lookup query:');
    
    // First, let's see what users we have
    const usersResult = await pool.query(`
      SELECT id, email, user_type
      FROM users
      WHERE user_type = 'Agent'
      LIMIT 5
    `);
    
    console.log(`Found ${usersResult.rows.length} agent users:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}, Email: ${user.email}, Type: ${user.user_type}`);
    });
    
    if (usersResult.rows.length > 0) {
      const testEmail = usersResult.rows[0].email;
      console.log(`\n🔍 Testing with email: ${testEmail}`);
      
      // Test the exact query from the API
      const memberIdQuery = `
        SELECT a.member_id
        FROM agents a
        INNER JOIN users u ON a.user_id = u.id
        WHERE u.email = $1
      `;
      
      const memberIdResult = await pool.query(memberIdQuery, [testEmail]);
      console.log('Member ID query result:', memberIdResult.rows);
      
      if (memberIdResult.rows.length > 0) {
        const memberId = memberIdResult.rows[0].member_id;
        console.log(`\n✅ Found member_id: ${memberId}`);
        
        // Now test the team agents query
        console.log('\n🔍 Testing team agents query:');
        const teamAgentsQuery = `
          SELECT 
            u.id,
            u.email,
            TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,''))) as name,
            COALESCE(pi.profile_picture, '') as avatar,
            a.member_id,
            m.company as team_name
          FROM users u
          INNER JOIN agents a ON u.id = a.user_id
          INNER JOIN members m ON a.member_id = m.id
          LEFT JOIN personal_info pi ON pi.user_id = u.id
          WHERE a.member_id = $1
          ORDER BY (TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,'')))) NULLS LAST, u.email
          LIMIT 50
        `;
        
        const teamAgentsResult = await pool.query(teamAgentsQuery, [memberId]);
        console.log(`Found ${teamAgentsResult.rows.length} agents in team ${memberId}:`);
        teamAgentsResult.rows.forEach((agent, index) => {
          console.log(`  ${index + 1}. ${agent.name || agent.email} (${agent.email}) - Team: ${agent.team_name}`);
        });
        
        // Get team info
        const teamQuery = `
          SELECT company, badge_color
          FROM members
          WHERE id = $1
        `;
        const teamResult = await pool.query(teamQuery, [memberId]);
        console.log('\n🏢 Team info:', teamResult.rows[0]);
        
      } else {
        console.log('❌ No member_id found for this user');
      }
    }
    
    console.log('\n✅ Simple test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error in simple test:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testTeamAgentsSimple();
