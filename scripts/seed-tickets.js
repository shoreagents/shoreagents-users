#!/usr/bin/env node

/**
 * Ticket Seeding Script for ShoreAgents
 * This script populates the tickets table with sample data
 */

const { Pool } = require('pg');

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Sample tickets to seed
const sampleTickets = [
  {
    ticket_id: 'TKT-2024001',
    title: 'Email Login Issues',
    concern: 'Cannot login to email account',
    details: 'Getting authentication errors when trying to access company email. Tried resetting password but still cannot login. Issue started this morning around 9 AM',
    category: 'Technical Support',
    status: 'pending'
  },
  {
    ticket_id: 'TKT-2024002', 
    title: 'Software Installation Request',
    concern: 'Need new software installed on workstation',
    details: 'Require Adobe Photoshop and Microsoft Project for upcoming client work. Please install latest versions',
    category: 'Software Request',
    status: 'in-progress'
  },
  {
    ticket_id: 'TKT-2024003',
    title: 'VPN Connection Problems',
    concern: 'VPN keeps disconnecting during work hours',
    details: 'VPN connection drops every 30-45 minutes. Affecting productivity and client calls. Using company provided VPN client',
    category: 'Network Issue',
    status: 'resolved'
  },
  {
    ticket_id: 'TKT-2024004',
    title: 'Printer Not Working',
    concern: 'Office printer shows error message',
    details: 'Printer displays "Paper Jam" error but no paper is stuck. Cannot print any documents. Tried turning off and on, same error persists',
    category: 'Hardware Issue',
    status: 'pending'
  },
  {
    ticket_id: 'TKT-2024005',
    title: 'Access Request',
    concern: 'Need access to client database',
    details: 'Require read/write access to the ARIA FIRST HOMES client database for property management tasks. Urgent - client meeting tomorrow',
    category: 'Access Request',
    status: 'pending'
  }
];

async function seedTickets() {
  let pool;
  
  try {
    console.log('🎫 Starting ticket seeding...\n');

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
        AND table_name IN ('tickets', 'users')
      `;
      
      const tablesResult = await client.query(tablesQuery);
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      if (!existingTables.includes('tickets')) {
        console.log('❌ Missing tickets table. Please run the ticketing schema migration first.');
        console.log('File: migrations/004_ticketing_schema.sql');
        return;
      }

      if (!existingTables.includes('users')) {
        console.log('❌ Missing users table. Please run the user schema migration first.');
        return;
      }
      
      console.log('✅ Required tables exist\n');

      // Get a sample agent user to assign tickets to
      const agentQuery = `
        SELECT id FROM users 
        WHERE user_type = 'Agent' 
        LIMIT 1
      `;
      const agentResult = await client.query(agentQuery);
      
      if (agentResult.rows.length === 0) {
        console.log('❌ No Agent users found. Please seed users first.');
        console.log('Run: npm run seed-db-full');
        return;
      }

      const agentUserId = agentResult.rows[0].id;
      console.log(`👤 Using agent user ID: ${agentUserId} for ticket creation\n`);

      // Seed tickets
      console.log('🎫 Seeding tickets...');
      
      for (const ticketData of sampleTickets) {
        console.log(`  Processing ticket: ${ticketData.ticket_id}`);
        
        // Check if ticket already exists
        const existingTicketQuery = 'SELECT id FROM tickets WHERE ticket_id = $1';
        const existingTicketResult = await client.query(existingTicketQuery, [ticketData.ticket_id]);
        
        if (existingTicketResult.rows.length > 0) {
          console.log(`  ⚠️  Ticket ${ticketData.ticket_id} already exists, skipping...`);
          continue;
        }

        // Insert ticket
        const insertTicketQuery = `
          INSERT INTO tickets (
            ticket_id, user_id, title, concern, details, 
            category, status
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7::ticket_status_enum)
        `;
        
        await client.query(insertTicketQuery, [
          ticketData.ticket_id,
          agentUserId,
          ticketData.title,
          ticketData.concern,
          ticketData.details,
          ticketData.category,
          ticketData.status
        ]);
        
        console.log(`  ✅ Successfully created ticket: ${ticketData.ticket_id} (${ticketData.status})`);
      }
      
      console.log('\n🎉 Ticket seeding completed successfully!');
      console.log('\n📋 Created tickets:');
      sampleTickets.forEach(ticket => {
        console.log(`  • ${ticket.ticket_id} - ${ticket.title} (${ticket.status})`);
      });
      
      console.log('\n📊 Ticket summary:');
      const statusSummary = sampleTickets.reduce((acc, ticket) => {
        acc[ticket.status] = (acc[ticket.status] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(statusSummary).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} tickets`);
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Ticket seeding failed:', error);
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('💡 Hint: Please create the ticketing schema first');
      console.error('    Run: migrations/004_ticketing_schema.sql');
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
  seedTickets()
    .then(() => {
      console.log('\n✨ Ticket seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { seedTickets }; 