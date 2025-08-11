const { Client } = require('pg')

async function checkCurrentUser() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('🔗 Connecting to database...')
    await client.connect()
    console.log('✅ Connected to database')

    // Check existing tickets and their owners
    console.log('\n📋 Checking existing tickets and owners...')
    const ticketsResult = await client.query(`
      SELECT 
        t.id, 
        t.ticket_id, 
        t.concern, 
        t.user_id,
        u.email as owner_email
      FROM tickets t
      LEFT JOIN users u ON t.user_id = u.id
      ORDER BY t.id
    `)
    
    if (ticketsResult.rows.length > 0) {
      console.log('📊 Existing tickets:')
      ticketsResult.rows.forEach(row => {
        console.log(`  - Ticket ID: ${row.ticket_id}, Owner: ${row.owner_email} (ID: ${row.user_id}), Concern: ${row.concern}`)
      })
    } else {
      console.log('📊 No existing tickets found')
    }

    // Check all users
    console.log('\n📋 Checking all users...')
    const usersResult = await client.query('SELECT id, email, user_type FROM users ORDER BY id')
    
    if (usersResult.rows.length > 0) {
      console.log('📊 All users:')
      usersResult.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Email: ${row.email}, Type: ${row.user_type}`)
      })
    } else {
      console.log('📊 No users found')
    }

    // Create a test ticket for user ID 2 (kyle.p@shoreagents.com) since that's who owns TKT-000001
    console.log('\n📝 Creating a test ticket for user ID 2...')
    
    // Get a category
    const categoryResult = await client.query('SELECT id, name FROM ticket_categories LIMIT 1')
    if (categoryResult.rows.length === 0) {
      console.log('❌ No categories found')
      return
    }
    
    const categoryId = categoryResult.rows[0].id
    const categoryName = categoryResult.rows[0].name
    console.log(`✅ Using category: ${categoryName} (ID: ${categoryId})`)

    // Create a test ticket for user ID 2
    const insertTicketQuery = `
      INSERT INTO tickets (
        user_id, concern, details, category_id, position, 
        supporting_files, file_count, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() AT TIME ZONE 'Asia/Manila', NOW() AT TIME ZONE 'Asia/Manila')
      RETURNING id, ticket_id, concern, details, status, position, supporting_files, file_count, created_at
    `

    const ticketResult = await client.query(insertTicketQuery, [
      2, // user_id for kyle.p@shoreagents.com
      'Test ticket for current user',
      'This is a test ticket created for the current user to test the API',
      categoryId,
      2, // position
      ['test-file.pdf'], // supporting_files
      1 // file_count
    ])

    const newTicket = ticketResult.rows[0]
    console.log('✅ Test ticket created successfully!')
    console.log(`📊 Ticket ID: ${newTicket.ticket_id}`)
    console.log(`📊 Concern: ${newTicket.concern}`)
    console.log(`📊 Status: ${newTicket.status}`)
    console.log(`📊 Owner: User ID 2 (kyle.p@shoreagents.com)`)

    console.log('\n🎉 Test ticket created! You can now test the API with this ticket ID.')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await client.end()
    console.log('🔌 Database connection closed')
  }
}

// Load environment variables
require('dotenv').config({ path: '.env.local' })

// Run the test
checkCurrentUser()
