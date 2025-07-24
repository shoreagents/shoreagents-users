import { Pool, PoolClient } from 'pg';

// Database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create a connection pool
let pool: Pool | null = null;

/**
 * Initialize database connection (server-side only)
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Validate DATABASE_URL format
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://');
    }

    console.log('🔗 Attempting to connect to database...');
    console.log('📊 Database URL format:', dbUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

    // Create connection pool with timeout
    pool = new Pool({
      ...databaseConfig,
      connectionTimeoutMillis: 10000, // 10 second timeout
      query_timeout: 10000, // 10 second query timeout
    });

    // Test the connection with timeout
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('✅ Database connected successfully!');
      console.log('📊 Connection pool created');
      console.log('🔗 Database URL:', dbUrl.replace(/\/\/.*@/, '//***:***@')); // Hide credentials

      // Log additional connection info
      if (process.env.ENABLE_DATABASE_LOGGING === 'true') {
        console.log('📝 Database logging enabled');
      }
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Database connection failed:', error);
    
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes('ENOTFOUND')) {
        throw new Error(`Database host not found. Please check your DATABASE_URL and ensure the database service is running. Error: ${error.message}`);
      } else if (error.message.includes('ECONNREFUSED')) {
        throw new Error(`Database connection refused. Please check if the database service is running and accessible. Error: ${error.message}`);
      } else if (error.message.includes('timeout')) {
        throw new Error(`Database connection timeout. Please check your network connection and database availability. Error: ${error.message}`);
      }
    }
    
    throw error;
  }
};

/**
 * Get database client from pool (server-side only)
 */
export const getDatabaseClient = async (): Promise<PoolClient> => {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return await pool.connect();
};

/**
 * Execute a query with logging (server-side only)
 */
export const executeQuery = async <T = any>(
  query: string, 
  params?: any[]
): Promise<T[]> => {
  // Auto-initialize database if not already done
  if (!pool) {
    console.log('🔄 Database not initialized, initializing now...');
    await initializeDatabase();
  }
  
  const client = await getDatabaseClient();
  
  try {
    const startTime = Date.now();
    const result = await client.query(query, params);
    const duration = Date.now() - startTime;
    
    if (process.env.ENABLE_DATABASE_LOGGING === 'true') {
      console.log(`📊 Query executed in ${duration}ms:`, query.substring(0, 100) + '...');
    }
    
    return result.rows;
  } catch (error) {
    console.error('❌ Query execution failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Test database connection (server-side only)
 */
export const testDatabaseConnection = async (): Promise<boolean> => {
  try {
    const result = await executeQuery('SELECT NOW() as current_time');
    console.log('✅ Database connection test successful:', result[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

/**
 * Close database connection pool (server-side only)
 */
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    console.log('🔌 Database connection pool closed');
  }
};

/**
 * Get database connection status (server-side only)
 */
export const getDatabaseStatus = () => {
  return {
    isConnected: pool !== null,
    poolSize: pool ? pool.totalCount : 0,
    idleCount: pool ? pool.idleCount : 0,
    waitingCount: pool ? pool.waitingCount : 0,
  };
}; 