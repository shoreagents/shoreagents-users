import { useEffect } from 'react'

export function useTicketCommentsSocket(onEvent: (ev: any) => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Listen to socket-server forwarded events via browser socket (attached in socket context)
    const attach = () => {
      try {
        const sock = (window as any)._saSocket
        if (sock && sock.on) {
          const listener = (payload: any) => onEvent(payload)
          sock.on('ticket-comment', listener)
          return () => {
            try { sock.off?.('ticket-comment', listener) } catch {}
          }
        }
      } catch {}
      return () => {}
    }

    const detach = attach()
    return () => {
      try { detach() } catch {}
    }
  }, [onEvent])
}


