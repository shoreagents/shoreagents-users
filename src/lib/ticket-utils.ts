export interface Ticket {
  id: string
  name: string
  date: string
  concern: string
  comments: string
  category: string
  details: string
  nickname: string
  email: string
  files: string[]
  status: 'pending' | 'in-progress' | 'resolved'
  createdAt: string
  userId?: string // Add user ID to track ownership
}

export const getCurrentUser = () => {
  if (typeof window === 'undefined') return null
  
  const authData = localStorage.getItem("shoreagents-auth")
  if (!authData) return null
  
  try {
    const parsed = JSON.parse(authData)
    return parsed.user
  } catch {
    return null
  }
}

export const getUserTicketsKey = (userEmail: string) => {
  return `shoreagents-tickets-${userEmail}`
}

export const getTicketsForUser = (userEmail: string): Ticket[] => {
  if (typeof window === 'undefined') return []
  
  const key = getUserTicketsKey(userEmail)
  const storedTickets = localStorage.getItem(key)
  return storedTickets ? JSON.parse(storedTickets) : []
}

export const saveTicketsForUser = (userEmail: string, tickets: Ticket[]) => {
  if (typeof window === 'undefined') return
  
  const key = getUserTicketsKey(userEmail)
  localStorage.setItem(key, JSON.stringify(tickets))
}

export const addTicketForUser = (userEmail: string, ticket: Ticket) => {
  const tickets = getTicketsForUser(userEmail)
  const newTicket = { ...ticket, userId: userEmail }
  tickets.push(newTicket)
  saveTicketsForUser(userEmail, tickets)
  return newTicket
}

export const updateTicketForUser = (userEmail: string, ticketId: string, updates: Partial<Ticket>) => {
  const tickets = getTicketsForUser(userEmail)
  const updatedTickets = tickets.map(ticket => 
    ticket.id === ticketId ? { ...ticket, ...updates } : ticket
  )
  saveTicketsForUser(userEmail, updatedTickets)
}

export const getCurrentUserTickets = (): Ticket[] => {
  const user = getCurrentUser()
  if (!user) return []
  return getTicketsForUser(user.email)
} 