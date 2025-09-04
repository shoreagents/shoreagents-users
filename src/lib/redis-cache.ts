import { createClient } from 'redis'

// Redis client instance
let redisClient: ReturnType<typeof createClient> | null = null

/**
 * Initialize Redis connection
 */
export const initializeRedis = async (): Promise<void> => {
  try {
    if (!process.env.REDIS_URL) {
      console.log('⚠️ REDIS_URL not found, skipping Redis initialization')
      return
    }

    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
      },
    })

    redisClient.on('error', (err) => {
      console.error('❌ Redis Client Error:', err)
    })

    redisClient.on('connect', () => {
      console.log('✅ Redis Client Connected')
    })

    await redisClient.connect()
  } catch (error) {
    console.error('❌ Redis initialization failed:', error)
    redisClient = null
  }
}

/**
 * Get Redis client (initialize if needed)
 */
const getRedisClient = async () => {
  if (!redisClient) {
    await initializeRedis()
  }
  return redisClient
}

/**
 * Cache interface
 */
export const redisCache = {
  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient()
      if (!client) return null

      const value = await client.get(key)
      return value ? JSON.parse(value) : null
    } catch (error) {
      console.error('❌ Redis GET error:', error)
      return null
    }
  },

  /**
   * Set value in cache with TTL
   */
  async set<T = any>(key: string, value: T, ttlSeconds = 300): Promise<boolean> {
    try {
      const client = await getRedisClient()
      if (!client) return false

      await client.setEx(key, ttlSeconds, JSON.stringify(value))
      return true
    } catch (error) {
      console.error('❌ Redis SET error:', error)
      return false
    }
  },

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient()
      if (!client) return false

      await client.del(key)
      return true
    } catch (error) {
      console.error('❌ Redis DEL error:', error)
      return false
    }
  },

  /**
   * Invalidate keys by pattern
   */
  async invalidatePattern(pattern: string): Promise<boolean> {
    try {
      const client = await getRedisClient()
      if (!client) return false

      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(keys)
      }
      return true
    } catch (error) {
      console.error('❌ Redis INVALIDATE error:', error)
      return false
    }
  },

  /**
   * Check if Redis is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const client = await getRedisClient()
      return client !== null && client.isOpen
    } catch {
      return false
    }
  }
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  tickets: (email: string) => `tickets:${email}`,
  ticket: (ticketId: string) => `ticket:${ticketId}`,
  ticketComments: (ticketId: string) => `ticket-comments:${ticketId}`,
  ticketCategories: () => 'ticket_categories',
  user: (email: string) => `user:${email}`,
  notifications: (email: string) => `notifications:${email}`,
  breaksHistory: (userId: string, days: number, includeActive: boolean) => `breaks-history:${userId}:${days}:${includeActive}`,
  meetings: (userId: string, days: number, limit?: number, offset?: number) => 
    `meetings:${userId}:${days}${limit !== undefined ? `:${limit}:${offset || 0}` : ''}`,
  taskStats: () => 'task-statistics',
  weeklyActivity: (email: string, weeksToKeep: number) => `weekly-activity:${email}:${weeksToKeep}`,
  monthlyActivity: (email: string, monthsToKeep: number) => `monthly-activity:${email}:${monthsToKeep}`,
  leaderboard: (limit: number) => `leaderboard:${limit}`,
  productivity: (email: string, monthsBack: number) => `productivity:${email}:${monthsBack}`,
  // Task activity cache keys
  taskActivity: (email: string) => `task-activity:${email}`,
  taskGroups: () => 'task-groups',
  task: (taskId: number) => `task:${taskId}`,
  // Global search cache keys
  globalSearch: (userId: string, query: string) => `global-search:${userId}:${query.toLowerCase().trim()}`,
  // Team agents cache keys
  teamAgents: (userEmail: string) => `team-agents:${userEmail}`,
  userAuthData: (email: string) => `user-auth-data:${email}`,
  // Profile cache keys
  profile: (userEmail: string) => `profile:${userEmail}`,
  profileById: (userId: number) => `profile:${userId}`,
}

/**
 * Cache TTL constants (in seconds)
 */
export const cacheTTL = {
  tickets: 300, // 5 minutes
  ticket: 300, // 5 minutes
  ticketComments: 180, // 3 minutes (comments change more frequently)
  ticketCategories: 1800, // 30 minutes
  user: 600, // 10 minutes
  notifications: 60, // 1 minute
  breaksHistory: 120, // 2 minutes (breaks change frequently)
  meetings: 120, // 2 minutes (meetings change frequently)
  taskStats: 300, // 5 minutes
  weeklyActivity: 300, // 5 minutes (activity data changes frequently)
  monthlyActivity: 600, // 10 minutes (monthly data changes less frequently)
  leaderboard: 900, // 15 minutes (leaderboard changes less frequently)
  productivity: 600, // 10 minutes (productivity data changes less frequently)
  // Task activity cache TTL
  taskActivity: 120, // 2 minutes (tasks change frequently due to real-time updates)
  taskGroups: 600, // 10 minutes (groups change less frequently)
  task: 300, // 5 minutes (individual tasks)
  // Global search cache TTL
  globalSearch: 180, // 3 minutes (search results can change frequently)
  // Team agents cache TTL
  teamAgents: 300, // 5 minutes (team data changes less frequently)
  userAuthData: 60, // 1 minute (auth data changes frequently on login)
  // Profile cache TTL
  profile: 600, // 10 minutes (profile data changes infrequently)
}
