import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface TaskActivitySocket {
  socket: Socket | null
  isConnected: boolean
  emitTaskMoved: (taskId: string, newGroupId: string, task: any) => void
  emitTaskCreated: (groupId: string, task: any) => void
  emitGroupCreated: (group: any) => void
  emitGroupsReordered: (groupPositions: Array<{id: number, position: number}>) => void
}

export function useTaskActivitySocket(email: string | null): TaskActivitySocket {
  const socketRef = useRef<Socket | null>(null)
  const isConnectedRef = useRef(false)

  useEffect(() => {
    if (!email) {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      isConnectedRef.current = false
      return
    }

    // Connect to Socket.IO server
    socketRef.current = io('http://localhost:3001')

    socketRef.current.on('connect', () => {
      console.log('Task activity socket connected')
      isConnectedRef.current = true
      
      // Authenticate with email
      socketRef.current?.emit('authenticate', email)
    })

    socketRef.current.on('disconnect', () => {
      console.log('Task activity socket disconnected')
      isConnectedRef.current = false
    })

    socketRef.current.on('authenticated', (data) => {
      console.log('Task activity socket authenticated:', data)
    })

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      isConnectedRef.current = false
    }
  }, [email])

  const emitTaskMoved = (taskId: string, newGroupId: string, task: any) => {
    if (socketRef.current && email) {
      const eventData = {
        email,
        taskId,
        newGroupId,
        task
      }
      console.log('Socket emitting taskMoved:', eventData)
      socketRef.current.emit('taskMoved', eventData)
    } else {
      console.warn('Cannot emit taskMoved: socket not connected or email missing')
    }
  }

  const emitTaskCreated = (groupId: string, task: any) => {
    if (socketRef.current && email) {
      socketRef.current.emit('taskCreated', {
        email,
        groupId,
        task
      })
    }
  }

  const emitGroupCreated = (group: any) => {
    if (socketRef.current && email) {
      socketRef.current.emit('groupCreated', {
        email,
        group
      })
    }
  }

  const emitGroupsReordered = (groupPositions: Array<{id: number, position: number}>) => {
    if (socketRef.current && email) {
      socketRef.current.emit('groupsReordered', {
        email,
        groupPositions
      })
    }
  }

  return {
    socket: socketRef.current,
    isConnected: isConnectedRef.current,
    emitTaskMoved,
    emitTaskCreated,
    emitGroupCreated,
    emitGroupsReordered
  }
} 