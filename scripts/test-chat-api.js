require('dotenv').config({ path: '.env.local' });

async function testChatAPI() {
  try {
    console.log('🧪 Testing Chat API Endpoints...\n');

    // Test 1: Find conversation between users 2 and 4
    console.log('1️⃣ Testing find_conversation between users 2 and 4...');
    const findResponse = await fetch('http://localhost:3000/api/chat/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'find_conversation',
        userId: 2,
        otherUserId: 4
      })
    });

    const findData = await findResponse.json();
    console.log('Response:', findData);

    if (findData.success) {
      console.log(`✅ Found conversation: ${findData.conversationId}`);
      
      // Test 2: Get messages for this conversation
      console.log('\n2️⃣ Testing get_messages for conversation...');
      const messagesResponse = await fetch('http://localhost:3000/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_messages',
          userId: 2,
          conversationId: findData.conversationId
        })
      });

      const messagesData = await messagesResponse.json();
      console.log('Messages response:', messagesData);

      if (messagesData.success) {
        console.log(`✅ Found ${messagesData.messages.length} messages`);
        messagesData.messages.forEach((msg, index) => {
          console.log(`   Message ${index + 1}: ${msg.sender_name}: "${msg.content}"`);
        });
      } else {
        console.log('❌ Failed to get messages:', messagesData.error);
      }
    } else {
      console.log('❌ No conversation found, creating one...');
      
      // Test 3: Create new conversation
      console.log('\n3️⃣ Testing create_conversation...');
      const createResponse = await fetch('http://localhost:3000/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_conversation',
          userId: 2,
          otherUserId: 4
        })
      });

      const createData = await createResponse.json();
      console.log('Create response:', createData);
    }

  } catch (error) {
    console.error('❌ Error testing chat API:', error);
  }
}

// Run the test
testChatAPI();
