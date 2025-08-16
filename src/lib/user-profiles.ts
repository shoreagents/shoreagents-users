// DEPRECATED: This file contains static user profiles and should be replaced with API calls
// Use /api/profile endpoint instead for real database data

export interface UserProfile {
  number: string
  id_number: string
  last_name: string
  first_name: string
  middle_name: string
  gender: string
  phone: string
  email: string
  date_of_birth: string
  position: string
  company: string
  department: string
  start_date: string
  status: string
}

// DEPRECATED: Static profile data - use /api/profile instead
export const userProfiles: Record<string, UserProfile> = {
  "agent@shoreagents.com": {
    "number": "1",
    "id_number": "600991",
    "last_name": "VALENCIA",
    "first_name": "JERICHO MIGUELLE",
    "middle_name": "FERNANDEZ",
    "gender": "M",
    "phone": "09667785513",
    "email": "valenciajerichomiguelle@gmail.com",
    "date_of_birth": "01-Dec-99",
    "position": "ADMINISTRATIVE ASSISTANT",
    "company": "SHOREAGENTS",
    "department": "ARIA FIRST HOMES",
    "start_date": "14-Aug-23",
    "status": "REGULAR"
  },
  "agent0@shoreagents.com": {
    "number": "2",
    "id_number": "800017",
    "last_name": "NUQUI",
    "first_name": "APPLE MAE",
    "middle_name": "LUMASAG",
    "gender": "F",
    "phone": "09209690326",
    "email": "applemaelumasag@gmail.com",
    "date_of_birth": "26-Mar-96",
    "position": "SALES AND PROPERTY MANAGEMENT ADMINISTRATOR",
    "company": "SHOREAGENTS",
    "department": "BARRY PLANT REAL ESTATE",
    "start_date": "23-Oct-24",
    "status": "REGULAR"
  }
}

// DEPRECATED: Use /api/profile endpoint instead
export const getCurrentUserProfile = (): UserProfile | null => {
  if (typeof window === 'undefined') return null
  
  // Updated to work with new minimal localStorage structure
  const authData = localStorage.getItem("shoreagents-auth")
  if (!authData) return null
  
  try {
    const parsed = JSON.parse(authData)
    const userEmail = parsed.user?.email
    if (userEmail && userProfiles[userEmail]) {
      return userProfiles[userEmail]
    }
  } catch {
    return null
  }
  
  // Return fallback profile for unknown users
  return null
}

// NEW: Helper function to get minimal user info from localStorage
export const getCurrentUserInfo = () => {
  if (typeof window === 'undefined') return null
  
  const authData = localStorage.getItem("shoreagents-auth")
  if (!authData) return null
  
  try {
    const parsed = JSON.parse(authData)
    const user = parsed.user
    
    // For hybrid authentication, prioritize Railway ID for database operations
    if (user && parsed.hybrid && user.railway_id) {
      return {
        ...user,
        id: user.railway_id, // Use Railway ID for database queries
        supabase_id: user.id, // Keep Supabase ID for reference
      }
    }
    
    return user // Returns: { id, email, name, role, user_type }
  } catch {
    return null
  }
} 