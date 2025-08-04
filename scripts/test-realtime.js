const { io } = require('socket.io-client')

async function testRealtime() {
  console.log('Testing real-time Socket.IO functionality...')
  
  // Connect to Socket.IO server
  const socket = io('http://localhost:3001')
  
  socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO server')
    
    // Authenticate
    socket.emit('authenticate', 'bob@example.com')
  })
  
  socket.on('authenticated', (data) => {
    console.log('✅ Authenticated:', data)
    
    // Test emitting a task moved event
    console.log('Emitting test taskMoved event...')
    socket.emit('taskMoved', {
      email: 'bob@example.com',
      taskId: '36',
      newGroupId: '5',
      task: {
        id: 36,
        title: 'Test Task',
        position: 1,
        group_id: 5
      }
    })
  })
  
  socket.on('taskMoved', (data) => {
    console.log('✅ Received taskMoved event:', data)
  })
  
  socket.on('disconnect', () => {
    console.log('❌ Disconnected from Socket.IO server')
  })
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error)
  })
  
  // Cleanup after 5 seconds
  setTimeout(() => {
    socket.disconnect()
    process.exit(0)
  }, 5000)
}

testRealtime() 