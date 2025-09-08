const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function createDummyEvents() {
  try {
    console.log('🎉 Creating dummy events and activities...');
    
    // First, let's get a user with Internal type to be the creator
    const { rows: users } = await pool.query("SELECT id FROM users WHERE user_type = 'Internal' LIMIT 1");
    
    if (users.length === 0) {
      console.log('❌ No Internal users found. Creating a test user...');
      // Create a test Internal user
      const { rows: newUser } = await pool.query(`
        INSERT INTO users (email, user_type) 
        VALUES ('admin@shoreagents.com', 'Internal') 
        RETURNING id
      `);
      var creatorId = newUser[0].id;
    } else {
      var creatorId = users[0].id;
    }
    
    console.log(`👤 Using creator ID: ${creatorId}`);
    
    // Create dummy events
    const dummyEvents = [
      {
        title: "Team Building Activity",
        description: "Monthly team building event with games and activities to strengthen team bonds.",
        event_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days from now
        start_time: "14:00:00",
        end_time: "17:00:00",
        location: "Conference Room A",
        status: "upcoming"
      },
      {
        title: "All Hands Meeting",
        description: "Weekly all-hands meeting to discuss company updates and announcements.",
        event_date: new Date().toISOString().split('T')[0], // Today
        start_time: "10:00:00",
        end_time: "11:00:00",
        location: "Main Conference Room",
        status: "today"
      },
      {
        title: "Product Launch Party",
        description: "Celebration for the successful launch of our new product line.",
        event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 1 week from now
        start_time: "18:00:00",
        end_time: "22:00:00",
        location: "Rooftop Terrace",
        status: "upcoming"
      },
      {
        title: "Training Workshop: Customer Service Excellence",
        description: "Interactive workshop focused on improving customer service skills and techniques.",
        event_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
        start_time: "09:00:00",
        end_time: "12:00:00",
        location: "Training Center",
        status: "upcoming"
      },
      {
        title: "Monthly Review Meeting",
        description: "Monthly performance review and goal setting meeting for all departments.",
        event_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days ago
        start_time: "15:00:00",
        end_time: "16:30:00",
        location: "Board Room",
        status: "ended"
      },
      {
        title: "Holiday Party Planning Session",
        description: "Planning meeting for the upcoming holiday party and year-end celebration.",
        event_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days from now
        start_time: "13:00:00",
        end_time: "14:30:00",
        location: "Meeting Room B",
        status: "upcoming"
      },
      {
        title: "Client Presentation",
        description: "Important client presentation for the new project proposal.",
        event_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
        start_time: "11:00:00",
        end_time: "12:30:00",
        location: "Client Meeting Room",
        status: "upcoming"
      },
      {
        title: "Cancelled: Office Renovation Meeting",
        description: "This meeting has been cancelled due to scheduling conflicts.",
        event_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days from now
        start_time: "16:00:00",
        end_time: "17:00:00",
        location: "Conference Room C",
        status: "cancelled"
      },
      {
        title: "Health & Wellness Session",
        description: "Monthly health and wellness session with stress management techniques.",
        event_date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 days from now
        start_time: "15:30:00",
        end_time: "16:30:00",
        location: "Wellness Center",
        status: "upcoming"
      },
      {
        title: "Technology Update Briefing",
        description: "Briefing on the latest technology updates and system improvements.",
        event_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Yesterday
        start_time: "14:30:00",
        end_time: "15:30:00",
        location: "IT Department",
        status: "ended"
      }
    ];
    
    // Insert events
    for (const event of dummyEvents) {
      const { rows } = await pool.query(`
        INSERT INTO events (title, description, event_date, start_time, end_time, location, status, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        event.title,
        event.description,
        event.event_date,
        event.start_time,
        event.end_time,
        event.location,
        event.status,
        creatorId
      ]);
      
      console.log(`✅ Created event: ${event.title} (ID: ${rows[0].id})`);
    }
    
    // Create some dummy attendance records
    console.log('👥 Creating dummy attendance records...');
    
    // Get all users to create attendance records
    const { rows: allUsers } = await pool.query("SELECT id, email FROM users");
    const { rows: allEvents } = await pool.query("SELECT id FROM events ORDER BY id");
    
    // Create some random attendance records
    for (let i = 0; i < Math.min(5, allEvents.length); i++) {
      const eventId = allEvents[i].id;
      
      // Randomly select some users to mark as going
      const randomUsers = allUsers.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 3) + 1);
      
      for (const user of randomUsers) {
        const isGoing = Math.random() > 0.3; // 70% chance of going
        const isBack = isGoing && Math.random() > 0.5; // 50% chance of being back if going
        
        if (isGoing) {
          await pool.query(`
            INSERT INTO event_attendance (event_id, user_id, is_going, is_back, going_at, back_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (event_id, user_id) DO NOTHING
          `, [
            eventId,
            user.id,
            isGoing,
            isBack,
            isGoing ? new Date() : null,
            isBack ? new Date() : null
          ]);
          
          console.log(`👤 User ${user.email} marked as ${isGoing ? 'going' : 'not going'} to event ${eventId}${isBack ? ' and back' : ''}`);
        }
      }
    }
    
    console.log('🎉 Dummy events and activities created successfully!');
    console.log(`📊 Created ${dummyEvents.length} events with attendance records`);
    
  } catch (error) {
    console.error('❌ Error creating dummy events:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createDummyEvents();
