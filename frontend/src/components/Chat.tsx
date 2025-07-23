import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserSearch from './UserSearch';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  avatar: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface Message {
  _id: string;
  content: string;
  sender: {
    _id: string;
    username: string;
    avatar: string;
  };
  room?: string | null;
  recipient?: string | null;
  timestamp: Date;
  readBy: Array<{
    user: string;
    readAt: Date;
  }>;
}

interface Room {
  _id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  members: User[];
}

const Chat: React.FC = () => {
  const { user, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeChatType, setActiveChatType] = useState<'user' | 'room'>('user');
  const [messages, setMessages] = useState<Message[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io('http://localhost:5000');
      setSocket(newSocket);

      // Join socket with user data
      newSocket.emit('join', {
        userId: user.id,
        username: user.username,
      });

      // Socket event listeners
      newSocket.on('newMessage', (message: Message) => {
        console.log('📨 New message received:', message);
        setAllMessages(prev => [...prev, message]);
      });

      newSocket.on('userOnline', (userData: { userId: string; username: string }) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.add(userData.userId);
          return newSet;
        });
      });

      newSocket.on('userOffline', (userData: { userId: string; username: string }) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userData.userId);
          return newSet;
        });
      });

      newSocket.on('userTyping', (data: { userId: string; username: string; isTyping: boolean }) => {
        setTypingUsers(prev => {
          const newSet = new Set(prev);
          if (data.isTyping) {
            newSet.add(data.username);
          } else {
            newSet.delete(data.username);
          }
          return newSet;
        });
      });

      // Load initial data
      loadUsers();
      loadRooms();

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (activeChat) {
      loadMessages();
    }
  }, [activeChat, activeChatType]);

  // Filter messages based on active chat
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    let filteredMessages: Message[] = [];
    
    if (activeChatType === 'room') {
      filteredMessages = allMessages.filter(msg => msg.room === activeChat);
    } else if (activeChatType === 'user') {
      filteredMessages = allMessages.filter(msg => 
        (msg.sender._id === user?.id && msg.recipient === activeChat) ||
        (msg.sender._id === activeChat && msg.recipient === user?.id) ||
        (msg.recipient === user?.id && msg.sender._id === activeChat)
      );
    }

    setMessages(filteredMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
  }, [activeChat, activeChatType, allMessages, user?.id]);

  const loadUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadRooms = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/rooms');
      setRooms(response.data);
    } catch (error) {
      console.error('Error loading rooms:', error);
    }
  };

  const loadMessages = async () => {
    try {
      let response;
      if (activeChatType === 'room' && activeChat) {
        response = await axios.get(`http://localhost:5000/api/messages/${activeChat}`);
      } else if (activeChatType === 'user' && activeChat) {
        response = await axios.get(`http://localhost:5000/api/messages/direct/${activeChat}`);
      } else {
        setAllMessages([]);
        return;
      }
      
      console.log('📥 Loaded messages:', response.data);
      setAllMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
      setAllMessages([]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    const messageData = {
      content: newMessage,
      roomId: activeChatType === 'room' ? activeChat : null,
      recipientId: activeChatType === 'user' ? activeChat : null,
    };

    socket.emit('sendMessage', messageData);
    setNewMessage('');

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing', {
      roomId: activeChatType === 'room' ? activeChat : null,
      recipientId: activeChatType === 'user' ? activeChat : null,
      isTyping: false,
    });
  };

  const handleTyping = () => {
    if (!socket) return;

    socket.emit('typing', {
      roomId: activeChatType === 'room' ? activeChat : null,
      recipientId: activeChatType === 'user' ? activeChat : null,
      isTyping: true,
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', {
        roomId: activeChatType === 'room' ? activeChat : null,
        recipientId: activeChatType === 'user' ? activeChat : null,
        isTyping: false,
      });
    }, 2000);
  };

  const selectChat = (chatId: string, type: 'user' | 'room') => {
    console.log(`📱 Selecting chat: ${chatId} (${type})`);
    setActiveChat(chatId);
    setActiveChatType(type);
    setAllMessages([]); // Clear messages before loading new ones

    if (socket && type === 'room') {
      socket.emit('joinRoom', chatId);
    }
  };

  const getFilteredUsers = () => {
    return users.filter(user =>
      user.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredRooms = () => {
    return rooms.filter(room =>
      room.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getActiveChatName = () => {
    if (!activeChat) return 'Select a chat';
    
    if (activeChatType === 'room') {
      const room = rooms.find(r => r._id === activeChat);
      return room?.name || 'Unknown Room';
    } else {
      const userData = users.find(u => u.id === activeChat);
      return userData?.username || 'Unknown User';
    }
  };

  const getActiveChatStatus = () => {
    if (!activeChat) return '';
    
    if (activeChatType === 'user') {
      const userData = users.find(u => u.id === activeChat);
      if (userData) {
        return onlineUsers.has(userData.id) ? 'Online' : 'Offline';
      }
    } else {
      const room = rooms.find(r => r._id === activeChat);
      return room ? `${room.members.length} members` : '';
    }
    return '';
  };

  const handleSelectUser = (selectedUser: any) => {
    // Check if user is already in the users list
    const existingUser = users.find(u => u.id === selectedUser.id);
    if (!existingUser) {
      // Add user to the users list if not already present
      const newUser: User = {
        id: selectedUser.id,
        username: selectedUser.username,
        avatar: selectedUser.avatar,
        isOnline: selectedUser.isOnline,
        lastSeen: selectedUser.lastSeen
      };
      setUsers(prevUsers => [...prevUsers, newUser]);
    }
    
    // Start chat with the selected user
    selectChat(selectedUser.id, 'user');
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-info">
            <div className="user-avatar">
              {user?.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <h3>{user?.username}</h3>
              <div className="user-status">
                <div className="status-indicator"></div>
                Online
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="rooms-section">
          <div className="rooms-header">
            <h3 className="rooms-title">Conversations</h3>
            <button 
              className="new-chat-btn"
              onClick={() => setShowUserSearch(true)}
              title="Start new conversation"
            >
              + New Chat
            </button>
          </div>

          <div className="search-bar">
            <input
              type="text"
              className="form-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: '20px', padding: '12px 16px' }}
            />
          </div>

          <div className="room-list">
            {/* Users */}
            {getFilteredUsers().map((userData) => (
              <div
                key={userData.id}
                className={`room-item ${activeChat === userData.id && activeChatType === 'user' ? 'active' : ''}`}
                onClick={() => selectChat(userData.id, 'user')}
              >
                <div className="user-avatar" style={{ width: '35px', height: '35px', fontSize: '14px', marginRight: '12px' }}>
                  {userData.username.charAt(0).toUpperCase()}
                  {onlineUsers.has(userData.id) && <div className="status-indicator" style={{ position: 'absolute', bottom: '2px', right: '2px', width: '8px', height: '8px' }} />}
                </div>
                <div className="room-info">
                  <div className="room-name">{userData.username}</div>
                  <div className="room-status">
                    {onlineUsers.has(userData.id) ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>
            ))}

            {/* Rooms */}
            {getFilteredRooms().map((room) => (
              <div
                key={room._id}
                className={`room-item ${activeChat === room._id && activeChatType === 'room' ? 'active' : ''}`}
                onClick={() => selectChat(room._id, 'room')}
              >
                <div className="user-avatar" style={{ width: '35px', height: '35px', fontSize: '14px', marginRight: '12px' }}>
                  {room.name.charAt(0).toUpperCase()}
                </div>
                <div className="room-info">
                  <div className="room-name">{room.name}</div>
                  <div className="room-status">
                    {room.members.length} members
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="online-users">
          <h4 className="online-title">Online Now</h4>
          <div className="online-list">
            {Array.from(onlineUsers).map((userId) => {
              const userData = users.find(u => u.id === userId);
              return userData ? (
                <div key={userId} className="online-user">
                  {userData.username}
                </div>
              ) : null;
            })}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="main-chat">
        {activeChat ? (
          <>
            <div className="chat-header">
              <div className="room-info">
                <h2>{getActiveChatName()}</h2>
                <div className="room-subtitle">{getActiveChatStatus()}</div>
              </div>
              {typingUsers.size > 0 && (
                <div className="typing-indicator">
                  {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                </div>
              )}
            </div>

            <div className="messages-container">
              {messages.map((message) => (
                <div
                  key={message._id}
                  className={`message ${message.sender._id === user?.id ? 'own' : ''}`}
                >
                  <div className="message-avatar">
                    {message.sender.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="message-content">
                    <div className="message-header">
                      <span className="message-username">{message.sender.username}</span>
                      <span className="message-time">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="message-bubble">
                      {message.content}
                    </div>
                  </div>
                </div>
              ))}
              
              <div ref={messagesEndRef} />
            </div>

            <div className="message-input-container">
              <form className="message-input-form" onSubmit={handleSendMessage}>
                <textarea
                  className="message-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  rows={1}
                />
                <button type="submit" className="send-button">
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="welcome-message">
            Select a conversation to start chatting
          </div>
        )}
      </div>
      
      {/* User Search Modal */}
      {showUserSearch && (
        <UserSearch
          onSelectUser={handleSelectUser}
          onClose={() => setShowUserSearch(false)}
        />
      )}
    </div>
  );
};

export default Chat;
