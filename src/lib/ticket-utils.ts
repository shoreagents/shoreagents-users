export interface Ticket {
  id: string
  name: string
  date: string
  concern: string
  category: string
  details: string
  email: string
  files: string[]
  status: 'pending' | 'in-progress' | 'resolved' | 'on-hold'
  createdAt: string
  userId?: number // Use actual database user ID (integer)
  userEmail?: string // Keep email for localStorage key generation
  resolvedBy?: number // ID of user who resolved the ticket
  resolvedByEmail?: string // Email of user who resolved the ticket
  resolvedAt?: string // Timestamp when ticket was resolved
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
  const currentUser = getCurrentUser()
  const newTicket = { 
    ...ticket, 
    userId: currentUser?.id ? Number(currentUser.id) : undefined, // Use actual database user ID as number
    userEmail: userEmail // Keep email for reference
  }
  tickets.push(newTicket)
  saveTicketsForUser(userEmail, tickets)
  
  // Add smart notification for new ticket creation
  if (typeof window !== 'undefined') {
    const { addSmartNotification } = require('./notification-service')
    addSmartNotification({
      type: 'info',
      title: 'New Support Ticket',
      message: `Ticket "${newTicket.name}" has been created`,
      icon: 'FileText',
      category: 'ticket',
      actionUrl: `/forms/${newTicket.id}`,
      actionData: { ticketId: newTicket.id }
    }, 'creation')
    
    // Trigger notification update event
    window.dispatchEvent(new CustomEvent('notifications-updated'))
  }
  
  return newTicket
}

export const updateTicketForUser = (userEmail: string, ticketId: string, updates: Partial<Ticket>) => {
  const tickets = getTicketsForUser(userEmail)
  const ticketIndex = tickets.findIndex(t => t.id === ticketId)
  
  if (ticketIndex === -1) return
  
  const originalTicket = tickets[ticketIndex]
  const updatedTickets = tickets.map(ticket => 
    ticket.id === ticketId ? { ...ticket, ...updates } : ticket
  )
  saveTicketsForUser(userEmail, updatedTickets)
  
  // Only create notification for significant status changes
  if (typeof window !== 'undefined' && updates.status === 'resolved' && originalTicket.status !== 'resolved') {
    const updatedTicket = updatedTickets.find(t => t.id === ticketId)
    if (updatedTicket) {
      const { addSmartNotification } = require('./notification-service')
      addSmartNotification({
        type: 'success',
        title: 'Ticket Resolved',
        message: `Your ticket "${updatedTicket.name}" has been resolved`,
        icon: 'CheckCircle',
        category: 'ticket',
        actionUrl: `/forms/${updatedTicket.id}`,
        actionData: { ticketId: updatedTicket.id }
      }, 'completion')
      
      // Trigger notification update event
      window.dispatchEvent(new CustomEvent('notifications-updated'))
    }
  }
}

export const getCurrentUserTickets = (): Ticket[] => {
  const user = getCurrentUser()
  if (!user) return []
  return getTicketsForUser(user.email)
} 