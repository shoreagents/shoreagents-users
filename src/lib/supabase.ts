import { createClient } from '@supabase/supabase-js'

// Client-side Supabase client
let supabase: any = null
let supabaseAdmin: any = null

function getSupabase() {
  if (supabase) return supabase
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Missing Supabase environment variables. Please add to your .env.local file:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here`)
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  })
  
  return supabase
}

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    return null
  }

  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
  
  return supabaseAdmin
}

// Export functions instead of direct clients
export { getSupabase as supabase, getSupabaseAdmin as supabaseAdmin }

// User profile type for our agents
export interface AgentProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  nickname?: string
  phone?: string
  birthday?: string
  city?: string
  address?: string
  gender?: 'Male' | 'Female' | 'Other' | 'Prefer not to say'
  user_type: 'Agent'
  created_at: string
  updated_at: string
}

// Supabase auth helper functions
export const authHelpers = {
  async signInWithEmail(email: string, password: string) {
    const client = getSupabase()
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  async signOut() {
    const client = getSupabase()
    const { error } = await client.auth.signOut()
    return { error }
  },

  async getSession() {
    const client = getSupabase()
    const { data: { session } } = await client.auth.getSession()
    return session
  },

  async getUser() {
    const client = getSupabase()
    const { data: { user } } = await client.auth.getUser()
    return user
  },

  async updateUser(updates: { password?: string; email?: string }) {
    const client = getSupabase()
    const { data, error } = await client.auth.updateUser(updates)
    return { data, error }
  },

  // Check if user is an agent via Railway database
  async isUserAgent(email: string): Promise<boolean> {
    try {
      // This will be handled by the login API route's hybrid validation
      // For now, we'll assume validation is done server-side
      return true // The API route will handle the actual validation
    } catch (error) {
      console.error('Error checking user agent status:', error)
      return false
    }
  }
}