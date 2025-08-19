const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function testTeamAgentsAPI() {
  try {
    console.log('🧪 Testing Team Agents API...\n');
    
    // First, let's see what agents and members we have in the database
    console.log('📊 Current database state:');
    
    const agentsResult = await pool.query(`
      SELECT 
        a.user_id,
        a.member_id,
        u.email,
        pi.first_name,
        pi.last_name,
        m.company
      FROM agents a
      INNER JOIN users u ON a.user_id = u.id
      INNER JOIN members m ON a.member_id = m.id
      LEFT JOIN personal_info pi ON pi.user_id = u.id
      ORDER BY a.member_id, u.email
    `);
    
    console.log(`Found ${agentsResult.rows.length} agents:`);
    agentsResult.rows.forEach((agent, index) => {
      console.log(`  ${index + 1}. ${agent.email} (${agent.first_name || ''} ${agent.last_name || ''}) - Team: ${agent.company} (member_id: ${agent.member_id})`);
    });
    
    console.log('\n🏢 Members/Teams:');
    const membersResult = await pool.query(`
      SELECT id, company, badge_color
      FROM members
      ORDER BY id
    `);
    
    membersResult.rows.forEach((member) => {
      console.log(`  Member ID ${member.id}: ${member.company} (${member.badge_color || 'no color'})`);
    });
    
    // Test the team filtering logic
    console.log('\n🔍 Testing team filtering logic:');
    
    // Get a sample member_id to test with
    if (agentsResult.rows.length > 0) {
      const sampleMemberId = agentsResult.rows[0].member_id;
      console.log(`Testing with member_id: ${sampleMemberId}`);
      
      const teamAgentsResult = await pool.query(`
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
      `, [sampleMemberId]);
      
      console.log(`\nAgents in team ${sampleMemberId}:`);
      teamAgentsResult.rows.forEach((agent, index) => {
        console.log(`  ${index + 1}. ${agent.name || agent.email} (${agent.email}) - Team: ${agent.team_name}`);
      });
      
      // Test search functionality
      if (teamAgentsResult.rows.length > 0) {
        const searchTerm = teamAgentsResult.rows[0].email.split('@')[0]; // Use part of email as search
        console.log(`\n🔍 Testing search with term: "${searchTerm}"`);
        
        const searchResult = await pool.query(`
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
          AND (LOWER(u.email) LIKE $2 OR LOWER(COALESCE(pi.first_name,'') || ' ' || COALESCE(pi.last_name,'')) LIKE $2)
          ORDER BY (TRIM(CONCAT(COALESCE(pi.first_name,''), ' ', COALESCE(pi.last_name,'')))) NULLS LAST, u.email
          LIMIT 50
        `, [sampleMemberId, `%${searchTerm.toLowerCase()}%`]);
        
        console.log(`Search results: ${searchResult.rows.length} agents found`);
        searchResult.rows.forEach((agent, index) => {
          console.log(`  ${index + 1}. ${agent.name || agent.email} (${agent.email})`);
        });
      }
    }
    
    console.log('\n✅ Team Agents API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Team Agents API:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testTeamAgentsAPI();
