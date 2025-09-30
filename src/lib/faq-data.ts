export interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  keywords: string[]
  searchTerms: string[]
  score?: number
}

export const faqData: FAQItem[] = [
  {
    id: "submit-ticket",
    question: "How do I submit a support ticket?",
    answer: "You can submit a support ticket by navigating to 'Support Tickets' → 'New Ticket' in the sidebar. Fill out the form with your details and submit. You'll receive a unique ticket ID for tracking.",
    category: "General Support",
    keywords: ["submit", "ticket", "support", "create", "new"],
    searchTerms: ["how to file a ticket", "how to submit a ticket", "create ticket", "file ticket", "submit support", "new ticket"]
  },
  {
    id: "response-time",
    question: "How long does it take to get a response?",
    answer: "We typically respond to support tickets within 24-48 hours during business days. Urgent issues are prioritized and may receive faster responses.",
    category: "General Support",
    keywords: ["response", "time", "hours", "urgent", "priority"],
    searchTerms: ["response time", "how long", "when will", "urgent", "priority", "fast response"]
  },
  {
    id: "track-ticket",
    question: "Can I track the status of my ticket?",
    answer: "Yes! You can view all your tickets and their current status by going to 'Support Tickets' → 'My Tickets' in the sidebar. Each ticket shows its current status (Pending, In Progress, or Resolved).",
    category: "General Support",
    keywords: ["track", "status", "ticket", "view", "check"],
    searchTerms: ["track ticket", "ticket status", "view tickets", "check status", "my tickets"]
  },
  {
    id: "start-meeting",
    question: "How do I start a meeting?",
    answer: "Click the 'Start Meeting' button in the meeting indicator or go to the Status → Meetings page. The system will automatically track your meeting time and notify relevant parties.",
    category: "Meeting Management",
    keywords: ["start", "meeting", "begin", "join"],
    searchTerms: ["start meeting", "begin meeting", "how to start", "meeting management"]
  },
  {
    id: "end-meeting",
    question: "Can I end a meeting early?",
    answer: "Yes, you can end a meeting at any time by clicking the 'End Meeting' button. The system will record the actual meeting duration and update your status accordingly.",
    category: "Meeting Management",
    keywords: ["end", "meeting", "early", "stop"],
    searchTerms: ["end meeting", "stop meeting", "finish meeting", "meeting early"]
  },
  {
    id: "restroom-break",
    question: "How do I take a restroom break?",
    answer: "Click the restroom button (toilet icon) on the right side of your screen or from the Status → Restroom page. The system will track your break time and show a red indicator while you're away.",
    category: "Restroom Tracking",
    keywords: ["restroom", "break", "toilet", "bathroom"],
    searchTerms: ["restroom break", "bathroom break", "toilet break", "take break", "restroom status"]
  },
  {
    id: "restroom-hidden",
    question: "What if the restroom button is hidden?",
    answer: "If you're in a meeting, event, or other restricted state, the restroom button will be hidden. Complete your current activity first, then the restroom option will become available.",
    category: "Restroom Tracking",
    keywords: ["hidden", "restroom", "button", "restricted"],
    searchTerms: ["restroom hidden", "button hidden", "restroom not available", "restricted state"]
  },
  {
    id: "join-event",
    question: "How do I join an event or activity?",
    answer: "When an event is active, you'll see a notification popup. Click 'Join Event' to participate. You can also view upcoming events in the Status → Events section.",
    category: "Events & Activities",
    keywords: ["join", "event", "activity", "participate"],
    searchTerms: ["join event", "join activity", "participate", "event management"]
  },
  {
    id: "clinic-visit",
    question: "How do I go to the clinic?",
    answer: "First, submit a health check request through the health section. Once the company nurse approves your request, you'll receive a notification. Then you can click 'Go to Clinic' to update your status.",
    category: "Clinic & Health",
    keywords: ["clinic", "health", "nurse", "medical"],
    searchTerms: ["go to clinic", "clinic visit", "health check", "medical", "nurse"]
  },
  {
    id: "break-management",
    question: "How do I take a break?",
    answer: "Use the break management system to start your scheduled break. The system will automatically compute valid break time based on your shift schedule and enter kiosk mode for fullscreen display.",
    category: "Break Management",
    keywords: ["break", "kiosk", "schedule", "shift"],
    searchTerms: ["take break", "break management", "scheduled break", "kiosk mode"]
  },
  {
    id: "change-password",
    question: "How do I change my password?",
    answer: "Go to Settings → Change Password. You'll need to enter your current password and create a new secure password following the system requirements.",
    category: "Profile & Account Management",
    keywords: ["password", "change", "security", "account"],
    searchTerms: ["change password", "reset password", "password change", "account security"]
  },
  {
    id: "computer-issues",
    question: "What should I do if my computer/equipment isn't working?",
    answer: "Submit a support ticket under the 'Computer/Equipment' category. Include specific details about the issue, any error messages, and when the problem started. Our IT team will assist you.",
    category: "Technical Issues",
    keywords: ["computer", "equipment", "technical", "IT", "problem"],
    searchTerms: ["computer not working", "equipment issue", "technical problem", "IT support", "computer broken"]
  },
  {
    id: "team-status",
    question: "How can I see my team's status?",
    answer: "Go to the Settings → Team Status to view real-time team status, including who's in meetings, on breaks, at events, or only for collaboration.",
    category: "Team Status & Monitoring",
    keywords: ["team", "status", "colleagues", "monitoring"],
    searchTerms: ["team status", "colleagues", "team members", "who's online", "team monitoring"]
  }
]

// Function to search FAQ data based on natural language queries
export function searchFAQ(query: string): FAQItem[] {
  const searchTerm = query.toLowerCase().trim()
  
  if (searchTerm.length < 2) {
    return []
  }

  const results: FAQItem[] = []
  
  for (const item of faqData) {
    let score = 0
    
    // Check exact search terms (highest priority)
    for (const searchPhrase of item.searchTerms) {
      if (searchPhrase.toLowerCase().includes(searchTerm)) {
        score += 10
      }
    }
    
    // Check keywords
    for (const keyword of item.keywords) {
      if (keyword.toLowerCase().includes(searchTerm)) {
        score += 5
      }
    }
    
    // Check question content
    if (item.question.toLowerCase().includes(searchTerm)) {
      score += 3
    }
    
    // Check answer content
    if (item.answer.toLowerCase().includes(searchTerm)) {
      score += 1
    }
    
    // Check category
    if (item.category.toLowerCase().includes(searchTerm)) {
      score += 2
    }
    
    if (score > 0) {
      results.push({ ...item, score })
    }
  }
  
  // Sort by score (highest first)
  return results.sort((a, b) => (b as any).score - (a as any).score).slice(0, 5)
}
