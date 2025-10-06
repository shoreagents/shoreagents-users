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

      // Attempting to connect to database...

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
      // Database connected successfully
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
    await initializeDatabase();
  }
  
  const client = await getDatabaseClient();
  
  try {
    const startTime = Date.now();
    const result = await client.query(query, params);
    const duration = Date.now() - startTime;
    
    // Query executed successfully
    
    return result.rows;
  } catch (error) {
    console.error('Query execution failed:', error);
    throw error;
  } finally {
    client.release();
  }
};
export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
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
