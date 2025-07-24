#!/usr/bin/env node

/**
 * Database Seeding Script for ShoreAgents
 * This script populates the database with test users based on the provided schema
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Test users to seed
const testUsers = [
  {
    email: 'agent@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Agent',
    first_name: 'Agent',
    last_name: 'User',
    phone: '+1234567890',
    gender: 'Prefer not to say'
  },
  {
    email: 'agent0@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Agent',
    first_name: 'Agent',
    last_name: 'Zero',
    nickname: 'Agent0',
    phone: '+1234567891',
    gender: 'Male'
  },
  {
    email: 'client@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Client',
    first_name: 'Client',
    last_name: 'User',
    phone: '+1234567892',
    gender: 'Female'
  }
];

async function seedDatabase() {
  let pool;
  
  try {
    console.log('🌱 Starting database seeding...\n');

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

    // Check if tables exist
    console.log('🔍 Checking database schema...');
    const client = await pool.connect();
    
    try {
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'passwords', 'personal_info')
      `;
      
      const tablesResult = await client.query(tablesQuery);
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      const requiredTables = ['users', 'passwords', 'personal_info'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.log('❌ Missing required tables:', missingTables.join(', '));
        console.log('Please run the database schema creation script first.');
        return;
      }
      
      console.log('✅ All required tables exist\n');

      // Seed users
      console.log('👥 Seeding users...');
      
      for (const userData of testUsers) {
        console.log(`  Processing user: ${userData.email}`);
        
        // Check if user already exists
        const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
        const existingUserResult = await client.query(existingUserQuery, [userData.email]);
        
        if (existingUserResult.rows.length > 0) {
          console.log(`  ⚠️  User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        
        // Insert user
        const insertUserQuery = `
          INSERT INTO users (email, user_type) 
          VALUES ($1, $2) 
          RETURNING id
        `;
        const userResult = await client.query(insertUserQuery, [userData.email, userData.user_type]);
        const userId = userResult.rows[0].id;
        
        // Insert password
        const insertPasswordQuery = `
          INSERT INTO passwords (user_id, password) 
          VALUES ($1, $2)
        `;
        await client.query(insertPasswordQuery, [userId, hashedPassword]);
        
        // Insert personal info
        const insertPersonalInfoQuery = `
          INSERT INTO personal_info (user_id, first_name, last_name, nickname, phone, gender) 
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        await client.query(insertPersonalInfoQuery, [
          userId,
          userData.first_name,
          userData.last_name,
          userData.nickname || null,
          userData.phone,
          userData.gender
        ]);
        
        console.log(`  ✅ Successfully created user: ${userData.email}`);
      }
      
      console.log('\n🎉 Database seeding completed successfully!');
      console.log('\n📋 Created users:');
      testUsers.forEach(user => {
        console.log(`  • ${user.email} (${user.user_type})`);
      });
      console.log('\n🔐 All users have password: shoreagents123');
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('💡 Hint: Check if DATABASE_URL is correct and the database server is running');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Hint: Database server is not accepting connections');
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('💡 Hint: Please create the database schema first using the provided SQL');
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
  seedDatabase()
    .then(() => {
      console.log('\n✨ Seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase }; 