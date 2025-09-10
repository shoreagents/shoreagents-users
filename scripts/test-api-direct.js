const fetch = require('node-fetch')

async function testAPIDirect() {
  try {
    console.log('🧪 Testing API directly...')
    
    const response = await fetch('http://localhost:3000/api/events?bypass_cache=true', {
      method: 'GET',
      headers: {
        'Cookie': 'shoreagents-auth=' + encodeURIComponent(JSON.stringify({
          isAuthenticated: true,
          user: { id: 1, email: 'agent@shoreagents.com', user_type: 'Internal' }
        }))
      }
    })
    
    if (!response.ok) {
      console.error('❌ API Error:', response.status, response.statusText)
      const errorText = await response.text()
      console.error('Error details:', errorText)
      return
    }
    
    const data = await response.json()
    console.log('✅ API Response:')
    console.log('Success:', data.success)
    console.log('Events count:', data.events?.length || 0)
    
    if (data.events && data.events.length > 0) {
      console.log('\n📊 First few events:')
      data.events.slice(0, 3).forEach((event, index) => {
        console.log(`\nEvent ${index + 1}:`)
        console.log(`  Title: ${event.title}`)
        console.log(`  Assigned to: ${JSON.stringify(event.assigned_user_ids)} (type: ${typeof event.assigned_user_ids})`)
        console.log(`  Is Array: ${Array.isArray(event.assigned_user_ids)}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testAPIDirect()
