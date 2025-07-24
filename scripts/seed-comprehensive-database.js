#!/usr/bin/env node

/**
 * Comprehensive Database Seeding Script for ShoreAgents
 * This script populates the complete database with test data including members, agents, clients, and job info
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Test members/companies to seed
const testMembers = [
  {
    company: 'SHOREAGENTS MAIN',
    address: '123 Business District, Metro Manila, Philippines',
    phone: '+632-555-0100',
    logo: 'https://www.shoreagents.com/wp-content/uploads/2023/04/ShoreAgents-Logo.png',
    service: 'Virtual Assistant Services',
    status: 'Current Client',
    badge_color: '#22c55e',
    country: 'Philippines',
    website: '{https://shoreagents.com,https://app.shoreagents.com}'
  },
  {
    company: 'ARIA FIRST HOMES',
    address: '456 Real Estate Ave, Melbourne, Australia',
    phone: '+61-3-555-0200',
    service: 'Real Estate Services',
    status: 'Current Client',
    badge_color: '#3b82f6',
    country: 'Australia',
    website: '{https://ariafirsthomes.com.au}'
  },
  {
    company: 'BARRY PLANT REAL ESTATE',
    address: '789 Property Lane, Sydney, Australia',
    phone: '+61-2-555-0300',
    service: 'Property Management',
    status: 'Current Client',
    badge_color: '#f59e0b',
    country: 'Australia',
    website: '{https://barryplant.com.au}'
  }
];

// Test users with comprehensive data
const testUsers = [
  {
    email: 'agent@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Agent',
    personal_info: {
      first_name: 'Agent',
      last_name: 'User',
      phone: '+639123456789',
      birthday: '1995-06-15',
      city: 'Manila',
      address: '123 Agent Street, Quezon City',
      gender: 'Prefer not to say'
    },
    member_company: 'SHOREAGENTS MAIN',
    agent_data: {
      exp_points: 1250,
      department_id: 1
    },
    job_info: {
      employee_id: 'SA001',
      job_title: 'Senior Virtual Assistant',
      shift_period: 'Day Shift',
      shift_schedule: 'Monday to Friday',
      shift_time: '8:00 AM - 5:00 PM PHT',
      work_setup: 'Remote',
      employment_status: 'Regular',
      hire_type: 'Full-time',
      staff_source: 'Direct Hire',
      start_date: '2023-08-14'
    }
  },
  {
    email: 'agent0@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Agent',
    personal_info: {
      first_name: 'Agent',
      last_name: 'Zero',
      nickname: 'Agent0',
      phone: '+639987654321',
      birthday: '1996-03-26',
      city: 'Cebu',
      address: '456 Zero Avenue, Cebu City',
      gender: 'Male'
    },
    member_company: 'BARRY PLANT REAL ESTATE',
    agent_data: {
      exp_points: 2100,
      department_id: 2
    },
    job_info: {
      employee_id: 'BP002',
      job_title: 'Sales and Property Management Administrator',
      shift_period: 'Day Shift',
      shift_schedule: 'Monday to Friday',
      shift_time: '9:00 AM - 6:00 PM AEST',
      work_setup: 'Remote',
      employment_status: 'Regular',
      hire_type: 'Full-time',
      staff_source: 'Referral',
      start_date: '2024-10-23'
    }
  },
  {
    email: 'client@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Client',
    personal_info: {
      first_name: 'Client',
      last_name: 'User',
      phone: '+61411223344',
      birthday: '1988-12-10',
      city: 'Melbourne',
      address: '789 Client Road, Melbourne VIC',
      gender: 'Female'
    },
    member_company: 'ARIA FIRST HOMES',
    client_data: {
      department_id: 3
    }
  },
  {
    email: 'internal@shoreagents.com',
    password: 'shoreagents123',
    user_type: 'Internal',
    personal_info: {
      first_name: 'Internal',
      last_name: 'Staff',
      phone: '+632987654321',
      birthday: '1990-05-20',
      city: 'Makati',
      address: '321 Internal Drive, Makati City',
      gender: 'Male'
    },
    member_company: 'SHOREAGENTS MAIN',
    job_info: {
      employee_id: 'INT001',
      job_title: 'Operations Manager',
      shift_period: 'Day Shift',
      shift_schedule: 'Monday to Friday',
      shift_time: '8:00 AM - 5:00 PM PHT',
      work_setup: 'Hybrid',
      employment_status: 'Regular',
      hire_type: 'Full-time',
      staff_source: 'Internal Promotion',
      start_date: '2022-01-15'
    }
  }
];

async function seedComprehensiveDatabase() {
  let pool;
  
  try {
    console.log('🌱 Starting comprehensive database seeding...\n');

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
        AND table_name IN ('users', 'passwords', 'personal_info', 'members', 'agents', 'clients', 'job_info')
      `;
      
      const tablesResult = await client.query(tablesQuery);
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      const requiredTables = ['users', 'passwords', 'personal_info', 'members', 'agents', 'clients', 'job_info'];
      const missingTables = requiredTables.filter(table => !existingTables.includes(table));
      
      if (missingTables.length > 0) {
        console.log('❌ Missing required tables:', missingTables.join(', '));
        console.log('Please run the comprehensive database schema creation script first.');
        console.log('File: migrations/003_comprehensive_schema.sql');
        return;
      }
      
      console.log('✅ All required tables exist\n');

      // Step 1: Seed members/companies
      console.log('🏢 Seeding members/companies...');
      const memberIds = {};
      
      for (const memberData of testMembers) {
        console.log(`  Processing company: ${memberData.company}`);
        
        // Check if member already exists
        const existingMemberQuery = 'SELECT id FROM members WHERE company = $1';
        const existingMemberResult = await client.query(existingMemberQuery, [memberData.company]);
        
        if (existingMemberResult.rows.length > 0) {
          memberIds[memberData.company] = existingMemberResult.rows[0].id;
          console.log(`  ⚠️  Company ${memberData.company} already exists, using existing ID: ${memberIds[memberData.company]}`);
          continue;
        }

        // Insert member
        const insertMemberQuery = `
          INSERT INTO members (company, address, phone, logo, service, status, badge_color, country, website) 
          VALUES ($1, $2, $3, $4, $5, $6::member_status_enum, $7, $8, $9) 
          RETURNING id
        `;
        const memberResult = await client.query(insertMemberQuery, [
          memberData.company,
          memberData.address,
          memberData.phone,
          memberData.logo,
          memberData.service,
          memberData.status,
          memberData.badge_color,
          memberData.country,
          memberData.website
        ]);
        memberIds[memberData.company] = memberResult.rows[0].id;
        
        console.log(`  ✅ Successfully created company: ${memberData.company} (ID: ${memberIds[memberData.company]})`);
      }

      // Step 2: Seed users and related data
      console.log('\n👥 Seeding users...');
      
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
          VALUES ($1, $2::user_type_enum) 
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
          INSERT INTO personal_info (user_id, first_name, middle_name, last_name, nickname, phone, birthday, city, address, gender) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::gender_enum)
        `;
        await client.query(insertPersonalInfoQuery, [
          userId,
          userData.personal_info.first_name,
          userData.personal_info.middle_name || null,
          userData.personal_info.last_name,
          userData.personal_info.nickname || null,
          userData.personal_info.phone,
          userData.personal_info.birthday,
          userData.personal_info.city,
          userData.personal_info.address,
          userData.personal_info.gender
        ]);

        // Get member ID
        const memberId = memberIds[userData.member_company];
        if (!memberId) {
          throw new Error(`Member company ${userData.member_company} not found`);
        }

        // Insert agent or client data
        if (userData.user_type === 'Agent' && userData.agent_data) {
          const insertAgentQuery = `
            INSERT INTO agents (user_id, exp_points, member_id, department_id) 
            VALUES ($1, $2, $3, $4)
          `;
          await client.query(insertAgentQuery, [
            userId,
            userData.agent_data.exp_points,
            memberId,
            userData.agent_data.department_id
          ]);
        } else if (userData.user_type === 'Client' && userData.client_data) {
          const insertClientQuery = `
            INSERT INTO clients (user_id, member_id, department_id) 
            VALUES ($1, $2, $3)
          `;
          await client.query(insertClientQuery, [
            userId,
            memberId,
            userData.client_data.department_id
          ]);
        }

        // Insert job info (for agents and internal users)
        if (userData.job_info) {
          const insertJobInfoQuery = `
            INSERT INTO job_info (
              employee_id, ${userData.user_type === 'Agent' ? 'agent_user_id' : 'internal_user_id'},
              job_title, shift_period, shift_schedule, shift_time, 
              work_setup, employment_status, hire_type, staff_source, start_date
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;
          await client.query(insertJobInfoQuery, [
            userData.job_info.employee_id,
            userId,
            userData.job_info.job_title,
            userData.job_info.shift_period,
            userData.job_info.shift_schedule,
            userData.job_info.shift_time,
            userData.job_info.work_setup,
            userData.job_info.employment_status,
            userData.job_info.hire_type,
            userData.job_info.staff_source,
            userData.job_info.start_date
          ]);
        }
        
        console.log(`  ✅ Successfully created user: ${userData.email} (${userData.user_type})`);
      }
      
      console.log('\n🎉 Comprehensive database seeding completed successfully!');
      console.log('\n📋 Created data:');
      
      console.log('\n🏢 Companies:');
      testMembers.forEach(member => {
        console.log(`  • ${member.company} (${member.status})`);
      });
      
      console.log('\n👥 Users:');
      testUsers.forEach(user => {
        console.log(`  • ${user.email} (${user.user_type})`);
      });
      
      console.log('\n🔐 All users have password: shoreagents123');
      console.log('\n📊 Database now contains:');
      console.log('  - Complete user profiles with personal information');
      console.log('  - Company/member data with branding and contact info');
      console.log('  - Agent experience points and department assignments');
      console.log('  - Detailed job information and work schedules');
      console.log('  - Client and internal user classifications');
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Comprehensive database seeding failed:', error);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('💡 Hint: Check if DATABASE_URL is correct and the database server is running');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Hint: Database server is not accepting connections');
    } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('💡 Hint: Please create the comprehensive database schema first');
      console.error('    Run: migrations/003_comprehensive_schema.sql');
    } else if (error.message.includes('enum')) {
      console.error('💡 Hint: Make sure all ENUM types are created properly');
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
  seedComprehensiveDatabase()
    .then(() => {
      console.log('\n✨ Comprehensive seeding script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { seedComprehensiveDatabase }; 