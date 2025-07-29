const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

// Sample tasks data
const sampleTasks = [
  {
    task_id: 'task_email_setup_001',
    task_name: 'Setup Company Email Account',
    assignee: 'John Smith',
    status: 'not_started',
    priority: 'high',
    task_type: 'document',
    description: 'Configure new employee email account with proper access permissions and signature.',
    due_date: '2025-08-15',
    created_by: 'HR Manager',
    last_edited_by: 'HR Manager'
  },
  {
    task_id: 'task_bug_login_002',
    task_name: 'Fix Login Page Error',
    assignee: 'Alice Developer',
    status: 'in_progress',
    priority: 'medium',
    task_type: 'bug',
    description: 'Users are experiencing 500 errors when trying to log in during peak hours.',
    due_date: '2025-08-10',
    created_by: 'Tech Lead',
    last_edited_by: 'Alice Developer'
  },
  {
    task_id: 'task_feature_dark_003',
    task_name: 'Implement Dark Mode',
    assignee: 'Bob Frontend',
    status: 'not_started',
    priority: 'low',
    task_type: 'feature',
    description: 'Add dark mode toggle to user preferences with theme persistence.',
    due_date: '2025-09-01',
    created_by: 'Product Manager',
    last_edited_by: 'Product Manager'
  },
  {
    task_id: 'task_polish_ui_004',
    task_name: 'Polish Dashboard UI',
    assignee: 'Carol Designer',
    status: 'done',
    priority: 'medium',
    task_type: 'polish',
    description: 'Improve dashboard layout, spacing, and visual hierarchy for better UX.',
    due_date: '2025-07-20',
    created_by: 'UX Lead',
    last_edited_by: 'Carol Designer'
  },
  {
    task_id: 'task_doc_api_005',
    task_name: 'Update API Documentation',
    assignee: 'Dave Writer',
    status: 'in_progress',
    priority: 'medium',
    task_type: 'document',
    description: 'Update API documentation with new endpoints and authentication methods.',
    due_date: '2025-08-25',
    created_by: 'Backend Lead',
    last_edited_by: 'Dave Writer'
  }
];

async function seedTasks() {
  let pool;
  
  try {
    console.log('📋 Starting task seeding...\n');

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
        AND table_name IN ('tasks', 'users')
      `;
      
      const tablesResult = await client.query(tablesQuery);
      const existingTables = tablesResult.rows.map(row => row.table_name);
      
      if (!existingTables.includes('tasks')) {
        throw new Error('❌ Tables do not exist. Please run the migration first: npm run migrate-tasks');
      }
      
      if (!existingTables.includes('users')) {
        throw new Error('❌ Users table does not exist. Please run the user migration first.');
      }
      
      console.log('✅ Required tables exist\n');

      // Clear existing sample tasks (optional - you can remove this if you want to keep existing tasks)
      console.log('🧹 Clearing existing sample tasks...');
      await client.query("DELETE FROM tasks WHERE task_id LIKE 'task_%'");
      
      // Get a sample agent user_id
      const userQuery = "SELECT id FROM users WHERE user_type = 'Agent' LIMIT 1";
      const userResult = await client.query(userQuery);
      
      if (userResult.rows.length === 0) {
        throw new Error('❌ No agent users found. Please create at least one agent user first.');
      }
      
      const agentUserId = userResult.rows[0].id;
      console.log(`📋 Using agent user ID: ${agentUserId}\n`);

      // Create default statuses and types for the user
      console.log('📋 Creating default task statuses...');
      await client.query('SELECT create_default_task_statuses($1)', [agentUserId]);
      console.log('✅ Default statuses created');
      
      console.log('📋 Creating default task types...');
      await client.query('SELECT create_default_task_types($1)', [agentUserId]);
      console.log('✅ Default task types created\n');

      // Insert sample tasks
      console.log('📋 Creating sample tasks...');
      
      for (const taskData of sampleTasks) {
        // Convert status names to match our default statuses
        let statusName = taskData.status;
        if (statusName === 'not_started') statusName = 'Not Started';
        if (statusName === 'in_progress') statusName = 'In Progress';
        if (statusName === 'done') statusName = 'Done';
        
        // Convert task type names to match our default types
        let typeName = taskData.task_type;
        if (typeName === 'document') typeName = 'Document';
        if (typeName === 'bug') typeName = 'Bug';
        if (typeName === 'feature') typeName = 'Feature';
        if (typeName === 'polish') typeName = 'Polish';
        
        const insertTaskQuery = `
          INSERT INTO tasks (
            task_id, user_id, task_name, assignee, status_id, 
            priority, task_type_id, description, due_date,
            created_by, last_edited_by, created_at, updated_at
          ) 
          VALUES ($1, $2, $3, $4, 
                  (SELECT get_task_status_id($2, $5)),
                  $6::task_priority_enum, 
                  (SELECT get_task_type_id($2, $7)), 
                  $8, $9, $10, $11, 
                  NOW() AT TIME ZONE 'Asia/Manila', 
                  NOW() AT TIME ZONE 'Asia/Manila')
        `;
        
        await client.query(insertTaskQuery, [
          taskData.task_id,
          agentUserId,
          taskData.task_name,
          taskData.assignee,
          statusName,
          taskData.priority,
          typeName,
          taskData.description,
          taskData.due_date,
          taskData.created_by,
          taskData.last_edited_by
        ]);
        
        console.log(`  ✅ Successfully created task: ${taskData.task_id} (${statusName}, ${typeName})`);
      }
      
      console.log('\n🎉 Task seeding completed successfully!');
      console.log('\n📋 Created tasks:');
      sampleTasks.forEach(task => {
        console.log(`  • ${task.task_id} - ${task.task_name} (${task.status})`);
      });
      
      console.log('\n📊 Task summary:');
      const statusSummary = sampleTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(statusSummary).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} tasks`);
      });
      
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Error seeding tasks:', error.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run the seeding if this script is executed directly
if (require.main === module) {
  seedTasks();
}

module.exports = { seedTasks }; 