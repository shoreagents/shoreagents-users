interface SlackMessage {
  text: string
  blocks?: any[]
  attachments?: any[]
}

interface TicketData {
  id: string
  ticket_id: string
  concern: string
  details?: string
  category: string
  status: string
  created_at: string
  user_name?: string
  user_email?: string
  supporting_files?: string[]
  file_count?: number
}

interface SlackConfig {
  webhookUrl: string
  channel?: string
  username?: string
  iconEmoji?: string
}

class SlackService {
  private config: SlackConfig

  constructor() {
    this.config = {
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: process.env.SLACK_CHANNEL || '#test-ticketing',
      username: process.env.SLACK_BOT_NAME || 'ShoreAgents Support Bot',
      iconEmoji: process.env.SLACK_BOT_ICON || ':ticket:'
    }
  }

  /**
   * Send a new ticket notification to Slack
   */
  async sendNewTicketNotification(ticket: TicketData): Promise<boolean> {
    try {
      const message = this.formatNewTicketMessage(ticket)
      return await this.sendMessage(message)
    } catch (error) {
      console.error('Error sending new ticket notification to Slack:', error)
      return false
    }
  }

  /**
   * Send a ticket status update notification to Slack
   */
  async sendTicketStatusUpdate(ticket: TicketData, oldStatus: string): Promise<boolean> {
    try {
      const message = this.formatStatusUpdateMessage(ticket, oldStatus)
      return await this.sendMessage(message)
    } catch (error) {
      console.error('Error sending ticket status update to Slack:', error)
      return false
    }
  }

  /**
   * Send a file upload notification to Slack
   */
  async sendFileUploadNotification(ticket: TicketData, uploadedFiles: any[]): Promise<boolean> {
    try {
      const message = this.formatFileUploadMessage(ticket, uploadedFiles)
      return await this.sendMessage(message)
    } catch (error) {
      console.error('Error sending file upload notification to Slack:', error)
      return false
    }
  }

  /**
   * Send an updated ticket notification to Slack (with files)
   */
  async sendUpdatedTicketNotification(ticket: TicketData): Promise<boolean> {
    try {
      const message = this.formatUpdatedTicketMessage(ticket)
      return await this.sendMessage(message)
    } catch (error) {
      console.error('Error sending updated ticket notification to Slack:', error)
      return false
    }
  }

  /**
   * Send a custom message to Slack
   */
  async sendMessage(message: SlackMessage): Promise<boolean> {
    if (!this.config.webhookUrl) {
      console.warn('Slack webhook URL not configured')
      return false
    }

    try {
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: this.config.channel,
          username: this.config.username,
          icon_emoji: this.config.iconEmoji,
          ...message
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Slack API Error Details:')
        throw new Error(`Slack API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      return true
    } catch (error) {
      console.error('Failed to send message to Slack:', error)
      return false
    }
  }

  /**
   * Format a new ticket message for Slack
   */
  private formatNewTicketMessage(ticket: TicketData): SlackMessage {
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms/${ticket.id}`

    return {
      text: `New Support Ticket: ${ticket.ticket_id}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `New Support Ticket: ${ticket.ticket_id}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:*\n${ticket.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Category:*\n${ticket.category}`
            },
            {
              type: 'mrkdwn',
              text: `*Submitted by:*\n${ticket.user_name || 'Unknown User'}`
            },
            {
              type: 'mrkdwn',
              text: `*Email:*\n${ticket.user_email || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Created:*\n${new Date(ticket.created_at).toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`
            },
            {
              type: 'mrkdwn',
              text: `*Files:*\n${ticket.file_count || 0} attachment(s)`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Concern:*\n${ticket.concern}`
          }
        },
        ...(ticket.details ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Details:*\n${ticket.details}`
          }
        }] : []),
        ...(ticket.supporting_files && ticket.supporting_files.length > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Attachments:*\n${ticket.supporting_files.map((file: string, index: number) => `• ${file}`).join('\n')}`
          }
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Ticket'
              },
              url: ticketUrl,
              style: 'primary'
            }
          ]
        }
      ]
    }
  }

  /**
   * Format a status update message for Slack
   */
  private formatStatusUpdateMessage(ticket: TicketData, oldStatus: string): SlackMessage {
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms/${ticket.id}`
    const statusEmoji = this.getStatusEmoji(ticket.status)

    return {
      text: `${statusEmoji} Ticket ${ticket.ticket_id} status updated: ${oldStatus} → ${ticket.status}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusEmoji} Ticket Status Updated`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Ticket ID:*\n${ticket.ticket_id}`
            },
            {
              type: 'mrkdwn',
              text: `*Status Change:*\n${oldStatus} → ${ticket.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Category:*\n${ticket.category}`
            },
            {
              type: 'mrkdwn',
              text: `*Updated:*\n${new Date().toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Concern:*\n${ticket.concern}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Ticket'
              },
              url: ticketUrl,
              style: 'primary'
            }
          ]
        }
      ]
    }
  }

  /**
   * Format an updated ticket message for Slack (with files)
   */
  private formatUpdatedTicketMessage(ticket: TicketData): SlackMessage {
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms/${ticket.id}`
    
    // Format file list with clickable links
    const fileList = ticket.supporting_files && ticket.supporting_files.length > 0 
      ? ticket.supporting_files.map((file: any, index: number) => {
          const fileUrl = typeof file === 'string' ? file : (file.url || file)
          const fileName = typeof file === 'string' ? file.split('/').pop() || file : (file.name || 'Unknown file')
          return `${index + 1}. <${fileUrl}|${fileName}>`
        }).join('\n')
      : 'No files attached'

    return {
      text: `Support Ticket Updated: ${ticket.ticket_id}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `Support Ticket Updated: ${ticket.ticket_id}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Status:*\n${ticket.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Category:*\n${ticket.category}`
            },
            {
              type: 'mrkdwn',
              text: `*Submitted by:*\n${ticket.user_name || 'Unknown User'}`
            },
            {
              type: 'mrkdwn',
              text: `*Email:*\n${ticket.user_email || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Created:*\n${new Date(ticket.created_at).toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`
            },
            {
              type: 'mrkdwn',
              text: `*Files:*\n${ticket.file_count || 0} attachment(s)`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Concern:*\n${ticket.concern}`
          }
        },
        ...(ticket.details ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Details:*\n${ticket.details}`
          }
        }] : []),
        ...(ticket.supporting_files && ticket.supporting_files.length > 0 ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Attachments:*\n${fileList}`
          }
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Ticket'
              },
              url: ticketUrl,
              style: 'primary'
            }
          ]
        }
      ]
    }
  }

  /**
   * Format a file upload message for Slack
   */
  private formatFileUploadMessage(ticket: TicketData, uploadedFiles: any[]): SlackMessage {
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/forms/${ticket.id}`
    const fileCount = uploadedFiles.length
    const fileList = uploadedFiles.map((file: any, index: number) => {
      const fileUrl = typeof file === 'string' ? file : (file.url || file)
      const fileName = typeof file === 'string' ? file.split('/').pop() || file : (file.name || 'Unknown file')
      return `${index + 1}. <${fileUrl}|${fileName}>`
    }).join('\n')

    return {
      text: `Files uploaded to ticket ${ticket.ticket_id}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `Files Uploaded to Ticket ${ticket.ticket_id}`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Ticket ID:*\n${ticket.ticket_id}`
            },
            {
              type: 'mrkdwn',
              text: `*Files Added:*\n${fileCount} file(s)`
            },
            {
              type: 'mrkdwn',
              text: `*Category:*\n${ticket.category}`
            },
            {
              type: 'mrkdwn',
              text: `*Status:*\n${ticket.status}`
            },
            {
              type: 'mrkdwn',
              text: `*Submitted by:*\n${ticket.user_name || 'Unknown User'}`
            },
            {
              type: 'mrkdwn',
              text: `*Uploaded:*\n${new Date().toLocaleString('en-US', {
                timeZone: 'Asia/Manila',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Concern:*\n${ticket.concern}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Uploaded Files:*\n${fileList}`
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Ticket'
              },
              url: ticketUrl,
              style: 'primary'
            }
          ]
        }
      ]
    }
  }


  /**
   * Get emoji for status
   */
  private getStatusEmoji(status: string): string {
    switch (status.toLowerCase()) {
      case 'for approval': return '⏳'
      case 'on hold': return '⏸️'
      case 'in progress': return '🔄'
      case 'approved': return '✅'
      case 'completed': return '🎉'
      case 'resolved': return '✅'
      default: return '📋'
    }
  }
}

// Export singleton instance
export const slackService = new SlackService()
export default slackService
