import { Pool, PoolClient } from 'pg';

// Optimized database connection configuration
const databaseConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  statement_timeout: 30000, // 30 second statement timeout
  query_timeout: 30000, // 30 second query timeout
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Create a connection pool
let pool: Pool | null = null;

/**
 * Initialize optimized database connection
 */
export const initializeOptimizedDatabase = async (): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Validate DATABASE_URL format
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      throw new Error('DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://');
    }

    // Create connection pool with optimized settings
    pool = new Pool(databaseConfig);

    // Test the connection
    const client = await pool.connect();
    try {
      await client.query('SELECT NOW()');
      console.log('✅ Optimized database connection established');
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('❌ Optimized database connection failed:', error);
    throw error;
  }
};

/**
 * Execute a query with optimized connection handling
 */
export const executeOptimizedQuery = async <T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> => {
  if (!pool) {
    await initializeOptimizedDatabase();
  }

  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
};

/**
 * Execute a query with transaction support
 */
export const executeOptimizedTransaction = async <T = any>(
  queries: Array<{ query: string; params?: any[] }>
): Promise<T[]> => {
  if (!pool) {
    await initializeOptimizedDatabase();
  }

  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results: T[] = [];
    
    for (const { query, params = [] } of queries) {
      const result = await client.query(query, params);
      results.push(result.rows as T);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get a client for complex operations
 */
export const getOptimizedClient = async (): Promise<PoolClient> => {
  if (!pool) {
    await initializeOptimizedDatabase();
  }

  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  return await pool.connect();
};

/**
 * Close the database pool
 */
export const closeOptimizedDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Optimized database pool closed');
  }
};

// Optimized queries for tickets
export const optimizedTicketQueries = {
  // Get tickets for a user with optimized query
  getUserTickets: (userId: number, limit = 50, offset = 0) => `
    SELECT 
      t.id,
      t.ticket_id,
      t.concern,
      t.category_id,
      t.status,
      t.created_at,
      t.position,
      t.file_count,
      tc.name as category_name
    FROM tickets t
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    WHERE t.user_id = $1
    ORDER BY t.position ASC, t.created_at DESC
    LIMIT $2 OFFSET $3
  `,

  // Get ticket count for a user
  getUserTicketCount: (userId: number) => `
    SELECT COUNT(*) as count
    FROM tickets
    WHERE user_id = $1
  `,

  // Get tickets by status
  getTicketsByStatus: (userId: number, status: string, limit = 50) => `
    SELECT 
      t.id,
      t.ticket_id,
      t.concern,
      t.category_id,
      t.status,
      t.created_at,
      t.position,
      t.file_count,
      tc.name as category_name
    FROM tickets t
    LEFT JOIN ticket_categories tc ON t.category_id = tc.id
    WHERE t.user_id = $1 AND t.status = $2
    ORDER BY t.created_at DESC
    LIMIT $3
  `,
};
