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

export const getCurrentUserProfile = (): UserProfile | null => {
  if (typeof window === 'undefined') return null
  
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
  
  return null
} 