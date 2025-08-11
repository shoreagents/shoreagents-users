import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables. Please add to your .env.local file:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here`)
}

// Client-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Server-side Supabase client for admin operations (only create if service key is available)
export const supabaseAdmin = supabaseServiceKey ? createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
) : null

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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  async updateUser(updates: { password?: string; email?: string }) {
    const { data, error } = await supabase.auth.updateUser(updates)
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