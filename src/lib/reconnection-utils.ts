/**
 * Reconnection utilities for handling socket disconnections
 */

interface ReconnectionOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

interface ReconnectionState {
  attempts: number
  isReconnecting: boolean
  lastAttempt: number
}

class ReconnectionManager {
  private reconnectionStates = new Map<string, ReconnectionState>()
  private defaultOptions: Required<ReconnectionOptions> = {
    maxAttempts: 10,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 1.5
  }

  /**
   * Start reconnection process for a specific service
   */
  startReconnection(
    serviceId: string, 
    reconnectFn: () => Promise<boolean> | boolean,
    options: ReconnectionOptions = {}
  ): void {
    const opts = { ...this.defaultOptions, ...options }
    const state = this.reconnectionStates.get(serviceId) || {
      attempts: 0,
      isReconnecting: false,
      lastAttempt: 0
    }

    if (state.isReconnecting) {
      console.log(`🔄 Reconnection already in progress for ${serviceId}`)
      return
    }

    state.isReconnecting = true
    state.attempts = 0
    this.reconnectionStates.set(serviceId, state)

    this.attemptReconnection(serviceId, reconnectFn, opts)
  }

  /**
   * Stop reconnection process for a specific service
   */
  stopReconnection(serviceId: string): void {
    const state = this.reconnectionStates.get(serviceId)
    if (state) {
      state.isReconnecting = false
      this.reconnectionStates.set(serviceId, state)
    }
  }

  /**
   * Check if a service is currently reconnecting
   */
  isReconnecting(serviceId: string): boolean {
    const state = this.reconnectionStates.get(serviceId)
    return state?.isReconnecting || false
  }

  /**
   * Get reconnection status for a service
   */
  getStatus(serviceId: string): ReconnectionState | null {
    return this.reconnectionStates.get(serviceId) || null
  }

  private async attemptReconnection(
    serviceId: string,
    reconnectFn: () => Promise<boolean> | boolean,
    options: Required<ReconnectionOptions>
  ): Promise<void> {
    const state = this.reconnectionStates.get(serviceId)
    if (!state || !state.isReconnecting) {
      return
    }

    state.attempts++
    state.lastAttempt = Date.now()
    this.reconnectionStates.set(serviceId, state)

    console.log(`🔄 Reconnection attempt ${state.attempts}/${options.maxAttempts} for ${serviceId}`)

    try {
      const success = await reconnectFn()
      
      if (success) {
        console.log(`✅ Reconnection successful for ${serviceId} after ${state.attempts} attempts`)
        state.isReconnecting = false
        state.attempts = 0
        this.reconnectionStates.set(serviceId, state)
        return
      }
    } catch (error) {
      console.error(`❌ Reconnection attempt ${state.attempts} failed for ${serviceId}:`, error)
    }

    // Check if we should continue trying
    if (state.attempts >= options.maxAttempts) {
      console.error(`❌ Max reconnection attempts reached for ${serviceId}`)
      state.isReconnecting = false
      this.reconnectionStates.set(serviceId, state)
      return
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      options.baseDelay * Math.pow(options.backoffMultiplier, state.attempts - 1),
      options.maxDelay
    )

    console.log(`⏳ Waiting ${delay}ms before next reconnection attempt for ${serviceId}`)
    
    setTimeout(() => {
      this.attemptReconnection(serviceId, reconnectFn, options)
    }, delay)
  }
}

// Global reconnection manager instance
export const reconnectionManager = new ReconnectionManager()

/**
 * Hook for handling reconnections in React components
 */
export function useReconnection(serviceId: string) {
  const startReconnection = (reconnectFn: () => Promise<boolean> | boolean, options?: ReconnectionOptions) => {
    reconnectionManager.startReconnection(serviceId, reconnectFn, options)
  }

  const stopReconnection = () => {
    reconnectionManager.stopReconnection(serviceId)
  }

  const isReconnecting = reconnectionManager.isReconnecting(serviceId)
  const status = reconnectionManager.getStatus(serviceId)

  return {
    startReconnection,
    stopReconnection,
    isReconnecting,
    status
  }
}

/**
 * Utility function to create a reconnection handler for socket connections
 */
export function createSocketReconnectionHandler(
  socket: any,
  serviceId: string,
  options: ReconnectionOptions = {}
) {
  return () => {
    return new Promise<boolean>((resolve) => {
      if (!socket) {
        resolve(false)
        return
      }

      // Check if socket is already connected
      if (socket.connected) {
        resolve(true)
        return
      }

      // Set up one-time listeners
      const onConnect = () => {
        socket.off('connect', onConnect)
        socket.off('connect_error', onError)
        resolve(true)
      }

      const onError = () => {
        socket.off('connect', onConnect)
        socket.off('connect_error', onError)
        resolve(false)
      }

      socket.once('connect', onConnect)
      socket.once('connect_error', onError)

      // Attempt to connect
      socket.connect()
    })
  }
}
