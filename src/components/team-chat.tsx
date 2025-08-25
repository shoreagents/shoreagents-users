'use client';

import { useState, useEffect, useRef } from 'react';
import { useSocket } from '@/contexts/socket-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, MoreVertical, ArrowLeft } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface ChatMessage {
  id: string;
  senderId: number;
  senderName: string;
  content: string;
  timestamp: string;
  isOwn: boolean;
}

interface TeamChatProps {
  selectedUser: {
    id: number;
    email: string;
    name: string;
    avatar?: string;
  };
  onBack: () => void;
  currentUserId: number;
}

export default function TeamChat({ selectedUser, onBack, currentUserId }: TeamChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { socket, isConnected } = useSocket();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize conversation when component mounts
  useEffect(() => {
    if (selectedUser && currentUserId && socket) {
      initializeConversation();
    }
  }, [selectedUser, currentUserId, socket]);

  // Socket event listeners for real-time chat
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (messageData: any) => {
      if (messageData.conversationId === conversationId) {
        // Fix: Always use selectedUser.name for consistency since that's what the API returns
        // This ensures both typing indicator and sent messages show the same avatar
        const senderName = messageData.senderId === currentUserId 
          ? 'You' // For own messages, doesn't matter since they don't show avatar
          : selectedUser.name; // For other user, use the consistent name from API
        
        console.log('🔌 Socket message received:', {
          messageData,
          senderId: messageData.senderId,
          currentUserId,
          selectedUserName: selectedUser.name,
          finalSenderName: senderName,
          isOwn: messageData.senderId === currentUserId
        });
        
        const newChatMessage: ChatMessage = {
          id: messageData.id,
          senderId: messageData.senderId,
          senderName: senderName,
          content: messageData.content,
          timestamp: messageData.timestamp,
          isOwn: messageData.senderId === currentUserId
        };
        
        setMessages(prev => [...prev, newChatMessage]);
      }
    };

    const handleUserTyping = (data: any) => {
      if (data.conversationId === conversationId && data.userId !== currentUserId) {
        setOtherUserTyping(data.isTyping);
      }
    };

    const handleMessageDelivered = (data: any) => {
      // Handle message delivery confirmation
      console.log('Message delivered:', data);
    };

    socket.on('new-chat-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('message-delivered', handleMessageDelivered);

    return () => {
      socket.off('new-chat-message', handleNewMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('message-delivered', handleMessageDelivered);
    };
  }, [socket, conversationId, currentUserId, selectedUser.name]);

  const initializeConversation = async () => {
    try {
      setIsLoading(true);
      
      // Prevent users from chatting with themselves
      if (currentUserId === selectedUser.id) {
        console.error('❌ Cannot chat with yourself');
        throw new Error('You cannot chat with yourself');
      }
      
      console.log('🔍 Initializing conversation:', {
        currentUserId,
        selectedUserId: selectedUser.id,
        selectedUserName: selectedUser.name
      });
      
      // First, try to find existing conversation
      const findResponse = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'find_conversation',
          userId: currentUserId,
          otherUserId: selectedUser.id
        })
      });

      const findData = await findResponse.json();
      console.log('🔍 Find conversation response:', findData);
      
      let conversationId: number;

      if (findData.success) {
        // Use existing conversation
        conversationId = findData.conversationId;
        console.log('✅ Found existing conversation:', conversationId);
      } else {
        // Create new conversation
        console.log('🆕 Creating new conversation...');
        const createResponse = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_conversation',
            userId: currentUserId,
            otherUserId: selectedUser.id
          })
        });

        const createData = await createResponse.json();
        console.log('🔍 Create conversation response:', createData);
        
        if (createData.success) {
          conversationId = createData.conversationId;
          console.log('✅ Created new conversation:', conversationId);
        } else {
          console.error('❌ Failed to create conversation:', createData);
          throw new Error(createData.error || 'Failed to create conversation');
        }
      }
      
      setConversationId(conversationId);
      
      // Join chat room via socket
      if (socket) {
        socket.emit('join-chat', {
          userId: currentUserId,
          conversationId
        });
      }
      
      // Load existing messages
      await loadMessages(conversationId);
    } catch (error: any) {
      console.error('❌ Error initializing conversation:', error);
      // Show error to user
      alert(`Failed to start conversation: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (convId: number) => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          action: 'get_messages',
          userId: currentUserId,
          conversationId: convId,
          _t: Date.now() // Cache buster
        })
      });

      const data = await response.json();
      console.log('📨 API Response:', data);
      
      if (data.success) {
        console.log('📨 Messages from API:', data.messages);
        
        // Debug: Log each message's sender info
        data.messages.forEach((msg: any, index: number) => {
          console.log(`🔍 Message ${index + 1}:`, {
            id: msg.id,
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            sender_email: msg.sender_email,
            content: msg.content
          });
        });
        
        const chatMessages: ChatMessage[] = data.messages.map((msg: any) => ({
          id: msg.id.toString(),
          senderId: msg.sender_id,
          senderName: msg.sender_name || msg.sender_email,
          content: msg.content,
          timestamp: msg.created_at,
          isOwn: msg.sender_id === currentUserId
        }));
        
        console.log('📨 Processed chat messages:', chatMessages);
        
        // Debug: Log the final processed messages
        chatMessages.forEach((msg, index) => {
          console.log(`🎯 Final Message ${index + 1}:`, {
            id: msg.id,
            senderId: msg.senderId,
            senderName: msg.senderName,
            isOwn: msg.isOwn,
            avatarInitials: getInitials(msg.senderName)
          });
        });
        
        setMessages(chatMessages);
      } else {
        console.error('❌ API returned error:', data.error);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId || !socket) return;

    try {
      // Send via socket for real-time delivery
      socket.emit('send-chat-message', {
        userId: currentUserId,
        conversationId,
        messageContent: newMessage.trim(),
        messageType: 'text'
      });

      // Also send via API for persistence
      await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_message',
          userId: currentUserId,
          conversationId,
          messageContent: newMessage.trim()
        })
      });

      setNewMessage('');
      
      // Stop typing indicator
      setIsTyping(false);
      socket.emit('typing-indicator', {
        userId: currentUserId,
        conversationId,
        isTyping: false
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    
    // Send typing indicator
    if (socket && conversationId) {
      const shouldShowTyping = value.length > 0;
      if (shouldShowTyping !== isTyping) {
        setIsTyping(shouldShowTyping);
        socket.emit('typing-indicator', {
          userId: currentUserId,
          conversationId,
          isTyping: shouldShowTyping
        });
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid time';
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const deleteConversation = async () => {
    if (!conversationId || !currentUserId) return;
    
    // Add confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete this conversation with ${selectedUser.name}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_conversation',
          userId: currentUserId,
          conversationId: conversationId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Conversation deleted for current user');
        // Go back to user selection
        onBack();
      } else {
        console.error('❌ Failed to delete conversation:', data.error);
        alert('Failed to delete conversation');
      }
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      alert('Error deleting conversation');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <Avatar className="w-10 h-10">
            <AvatarImage src={selectedUser.avatar} />
            <AvatarFallback className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              {getInitials(selectedUser.name)}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {selectedUser.name || selectedUser.email.split('@')[0]}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="p-2">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={deleteConversation} className="text-red-600 dark:text-red-400">
                  Delete Conversation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Block User
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Report
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 h-full">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 dark:text-gray-400">No messages yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Start the conversation with {selectedUser.name || selectedUser.email.split('@')[0]}
              </p>
            </div>
          ) : (
            messages.map((message) => {
              // Debug: Log what's being rendered for each message
              console.log(`🎨 Rendering message ${message.id}:`, {
                senderId: message.senderId,
                senderName: message.senderName,
                isOwn: message.isOwn,
                avatarInitials: getInitials(message.senderName),
                selectedUserName: selectedUser.name,
                selectedUserInitials: getInitials(selectedUser.name)
              });
              
              return (
                <div
                  key={message.id}
                  className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${message.isOwn ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {!message.isOwn && (
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs">
                          {getInitials(message.senderName)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div className={`rounded-lg px-3 py-2 ${
                      message.isOwn
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.isOwn ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {formatTime(message.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          
          {/* Typing indicator */}
          {otherUserTyping && (
            <div className="flex justify-start">
              <div className="flex items-center space-x-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 text-xs">
                    {getInitials(selectedUser.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Input
            value={newMessage}
            onChange={handleTyping}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            disabled={!isConnected}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || !isConnected}
            className="px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        
        {!isConnected && (
          <p className="text-xs text-red-500 mt-2 text-center">
            Connection lost. Reconnecting...
          </p>
        )}
      </div>
    </div>
  );
}
