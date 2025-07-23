const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const CryptoJS = require('crypto-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with MongoDB when available)
const users = new Map();
const rooms = new Map();
const messages = new Map();

// Initialize default rooms
const defaultRooms = [
  {
    _id: 'room1',
    name: 'General',
    description: 'General discussion for everyone',
    isPrivate: false,
    members: [],
    admin: null,
    createdAt: new Date()
  },
  {
    _id: 'room2',
    name: 'Tech Talk',
    description: 'Discuss technology and programming',
    isPrivate: false,
    members: [],
    admin: null,
    createdAt: new Date()
  },
  {
    _id: 'room3',
    name: 'Random',
    description: 'Random conversations and fun',
    isPrivate: false,
    members: [],
    admin: null,
    createdAt: new Date()
  }
];

defaultRooms.forEach(room => {
  rooms.set(room._id, room);
});

console.log('In-memory storage initialized with default rooms');

// Generate key pair for encryption
const generateKeyPair = () => {
  return CryptoJS.lib.WordArray.random(256/8).toString();
};

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Encrypt message
const encryptMessage = (message, key) => {
  return CryptoJS.AES.encrypt(message, key).toString();
};

// Decrypt message
const decryptMessage = (encryptedMessage, key) => {
  const bytes = CryptoJS.AES.decrypt(encryptedMessage, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password, mobile } = req.body;
    
    // Check if user exists
    const existingUser = Array.from(users.values()).find(u => 
      u.email === email || 
      u.username === username || 
      (mobile && u.mobile === mobile)
    );
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this username, email, or mobile number' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate public key for encryption
    const publicKey = generateKeyPair();

    // Create user
    const userId = Date.now().toString();
    const user = {
      _id: userId,
      username,
      email,
      password: hashedPassword,
      avatar: '',
      isOnline: false,
      lastSeen: new Date(),
      publicKey,
      mobile: mobile || null
    };

    users.set(userId, user);

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        publicKey: user.publicKey,
        mobile: user.mobile
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login attempt:', { email, password: password ? '[HIDDEN]' : 'NO_PASSWORD' });

    // Find user by email or username
    const user = Array.from(users.values()).find(u => u.email === email || u.username === email);
    console.log('👤 User found:', user ? `${user.username} (${user.email})` : 'NO_USER_FOUND');
    
    if (!user) {
      console.log('❌ Login failed: User not found');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔑 Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Login failed: Invalid password');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    users.set(user._id, user);

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Chat routes
app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const roomList = Array.from(rooms.values()).map(room => ({
      ...room,
      members: room.members.map(memberId => {
        const user = users.get(memberId);
        return user ? {
          _id: user._id,
          username: user.username,
          avatar: user.avatar,
          isOnline: user.isOnline
        } : null;
      }).filter(Boolean)
    }));

    res.json(roomList);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    const roomId = Date.now().toString();
    const room = {
      _id: roomId,
      name,
      description,
      isPrivate,
      members: [req.user.userId],
      admin: req.user.userId,
      createdAt: new Date()
    };

    rooms.set(roomId, room);

    // Add user info to members
    const user = users.get(req.user.userId);
    const roomWithMembers = {
      ...room,
      members: [{
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        isOnline: user.isOnline
      }]
    };

    res.status(201).json(roomWithMembers);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/messages/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const roomMessages = Array.from(messages.values())
      .filter(msg => msg.room === roomId)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-50)
      .map(msg => {
        const sender = users.get(msg.sender);
        return {
          ...msg,
          sender: {
            _id: sender._id,
            username: sender.username,
            avatar: sender.avatar
          }
        };
      });

    res.json(roomMessages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get direct messages between two users
app.get('/api/messages/direct/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;
    
    const directMessages = Array.from(messages.values())
      .filter(msg => 
        (msg.sender === currentUserId && msg.recipient === userId) ||
        (msg.sender === userId && msg.recipient === currentUserId)
      )
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-50)
      .map(msg => {
        const sender = users.get(msg.sender);
        return {
          ...msg,
          content: msg.isEncrypted ? decryptMessage(msg.content, process.env.ENCRYPTION_KEY || 'default-key') : msg.content,
          sender: {
            _id: sender._id,
            username: sender.username,
            avatar: sender.avatar
          }
        };
      });

    res.json(directMessages);
  } catch (error) {
    console.error('Get direct messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const userList = Array.from(users.values())
      .filter(user => user._id !== req.user.userId)
      .map(user => ({
        id: user._id,
        username: user.username,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        mobile: user.mobile,
        isBot: user.isBot || false
      }));

    res.json(userList);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by username or mobile number
app.get('/api/search/users', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const searchResults = Array.from(users.values())
      .filter(user => {
        if (user._id === req.user.userId) return false;
        
        const matchesUsername = user.username.toLowerCase().includes(query.toLowerCase());
        const matchesMobile = user.mobile && user.mobile.includes(query);
        const matchesEmail = user.email.toLowerCase().includes(query.toLowerCase());
        
        return matchesUsername || matchesMobile || matchesEmail;
      })
      .map(user => ({
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        mobile: user.mobile,
        isBot: user.isBot || false
      }))
      .slice(0, 10); // Limit to 10 results

    res.json(searchResults);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Socket.io connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', async (userData) => {
    try {
      console.log(`👤 User joining: ${userData.username} (${userData.userId})`);
      const user = users.get(userData.userId);
      if (user) {
        user.isOnline = true;
        users.set(userData.userId, user);
        
        connectedUsers.set(socket.id, {
          userId: userData.userId,
          username: userData.username
        });

        // Join user's rooms
        Array.from(rooms.values()).forEach(room => {
          if (room.members.includes(userData.userId)) {
            socket.join(room._id);
          }
        });

        // Send welcome message from ChatBot
        setTimeout(() => {
          const chatBot = Array.from(users.values()).find(u => u.isBot);
          console.log(`🤖 ChatBot found: ${chatBot ? 'Yes' : 'No'}`);
          if (chatBot) {
            const welcomeMessages = [
              `👋 Welcome to ChatFlow, ${userData.username}! I'm ChatFlow Bot, your friendly assistant.`,
              `🎉 Great to see you here! Feel free to explore the chat rooms or start direct conversations.`,
              `💡 Pro tip: You can search for users by their username or mobile number using the search feature!`,
              `🚀 If you need any help navigating the app, just ask me. I'm here to help!`
            ];

            welcomeMessages.forEach((message, index) => {
              setTimeout(() => {
                const messageId = Date.now().toString() + index + Math.random().toString(36).substr(2, 9);
                
                // Store the message in backend
                const botMessage = {
                  _id: messageId,
                  content: message,
                  sender: chatBot._id,
                  room: null,
                  recipient: userData.userId,
                  messageType: 'text',
                  isEncrypted: false,
                  readBy: [],
                  timestamp: new Date()
                };
                
                messages.set(messageId, botMessage);

                // Send to user
                const welcomeMessage = {
                  _id: messageId,
                  content: message,
                  sender: {
                    _id: chatBot._id,
                    username: chatBot.username,
                    avatar: chatBot.avatar
                  },
                  room: null,
                  recipient: userData.userId,
                  messageType: 'text',
                  isEncrypted: false,
                  readBy: [],
                  timestamp: new Date()
                };

                socket.emit('newMessage', welcomeMessage);
                console.log(`📩 Bot message sent to ${userData.username}: ${message.substring(0, 50)}...`);
              }, index * 2000); // Send messages with 2-second intervals
            });
          }
        }, 1000); // Wait 1 second before sending welcome

        // Broadcast user online status
        socket.broadcast.emit('userOnline', {
          userId: userData.userId,
          username: userData.username
        });
      }
    } catch (error) {
      console.error('Join error:', error);
    }
  });

  socket.on('joinRoom', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(roomId);
    console.log(`User left room: ${roomId}`);
  });

  socket.on('sendMessage', async (data) => {
    try {
      const { content, roomId, recipientId, messageType = 'text' } = data;
      const userData = connectedUsers.get(socket.id);

      if (!userData) return;

      // Encrypt message content
      const encryptionKey = process.env.ENCRYPTION_KEY || 'default-key';
      const encryptedContent = encryptMessage(content, encryptionKey);

      const messageId = Date.now().toString();
      const message = {
        _id: messageId,
        content: encryptedContent,
        sender: userData.userId,
        room: roomId || null,
        recipient: recipientId || null,
        messageType,
        isEncrypted: true,
        readBy: [],
        timestamp: new Date()
      };

      messages.set(messageId, message);

      // Decrypt for sending to clients
      const sender = users.get(userData.userId);
      const decryptedMessage = {
        ...message,
        content: content, // Send original content to clients
        sender: {
          _id: sender._id,
          username: sender.username,
          avatar: sender.avatar
        }
      };

      if (roomId) {
        // Group message
        io.to(roomId).emit('newMessage', decryptedMessage);
      } else if (recipientId) {
        // Direct message
        socket.emit('newMessage', decryptedMessage);
        
        // Find recipient socket
        const recipientSocket = Array.from(connectedUsers.entries())
          .find(([_, user]) => user.userId === recipientId);
        
        if (recipientSocket) {
          io.to(recipientSocket[0]).emit('newMessage', decryptedMessage);
        }
      }

    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  socket.on('messageRead', async (data) => {
    try {
      const { messageId } = data;
      const userData = connectedUsers.get(socket.id);

      if (!userData) return;

      const message = messages.get(messageId);
      if (message) {
        message.readBy.push({
          user: userData.userId,
          readAt: new Date()
        });
        messages.set(messageId, message);

        socket.broadcast.emit('messageRead', {
          messageId,
          userId: userData.userId,
          readAt: new Date()
        });
      }

    } catch (error) {
      console.error('Message read error:', error);
    }
  });

  socket.on('typing', (data) => {
    const { roomId, recipientId, isTyping } = data;
    const userData = connectedUsers.get(socket.id);

    if (!userData) return;

    const typingData = {
      userId: userData.userId,
      username: userData.username,
      isTyping
    };

    if (roomId) {
      socket.to(roomId).emit('userTyping', typingData);
    } else if (recipientId) {
      const recipientSocket = Array.from(connectedUsers.entries())
        .find(([_, user]) => user.userId === recipientId);
      
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('userTyping', typingData);
      }
    }
  });

  socket.on('disconnect', async () => {
    try {
      const userData = connectedUsers.get(socket.id);
      
      if (userData) {
        const user = users.get(userData.userId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          users.set(userData.userId, user);
        }

        connectedUsers.delete(socket.id);

        // Broadcast user offline status
        socket.broadcast.emit('userOffline', {
          userId: userData.userId,
          username: userData.username,
          lastSeen: new Date()
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }

    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Using in-memory storage (no database required)');
  
  // Create default admin user after server starts
  try {
    const hashedPassword = await bcrypt.hash('password', 12);
    const adminId = 'admin-' + Date.now().toString();
    const adminUser = {
      _id: adminId,
      username: 'admin',
      email: 'admin@chatflow.com',
      password: hashedPassword,
      avatar: '',
      isOnline: false,
      lastSeen: new Date(),
      publicKey: generateKeyPair(),
      mobile: '+1234567890'
    };
    users.set(adminId, adminUser);
    console.log('✅ Default admin user created - Username: admin, Password: password');

    // Create ChatBot user
    const chatBotId = 'chatbot-' + Date.now().toString();
    const chatBotUser = {
      _id: chatBotId,
      username: 'ChatFlow_Bot',
      email: 'bot@chatflow.com',
      password: await bcrypt.hash('bot123', 12),
      avatar: '🤖',
      isOnline: true,
      lastSeen: new Date(),
      publicKey: generateKeyPair(),
      isBot: true,
      mobile: '+1800CHATBOT'
    };
    users.set(chatBotId, chatBotUser);
    console.log('🤖 ChatFlow Bot created');

    // Create random contacts
    const randomContacts = [
      { username: 'alice_wonder', email: 'alice@example.com', mobile: '+1234567891', avatar: '👩‍💼' },
      { username: 'bob_builder', email: 'bob@example.com', mobile: '+1234567892', avatar: '👨‍🔧' },
      { username: 'charlie_brown', email: 'charlie@example.com', mobile: '+1234567893', avatar: '�‍🎨' },
      { username: 'diana_prince', email: 'diana@example.com', mobile: '+1234567894', avatar: '👩‍⚖️' },
      { username: 'ethan_hunt', email: 'ethan@example.com', mobile: '+1234567895', avatar: '🕵️‍♂️' },
      { username: 'fiona_green', email: 'fiona@example.com', mobile: '+1234567896', avatar: '👩‍🌾' },
      { username: 'george_tech', email: 'george@example.com', mobile: '+1234567897', avatar: '👨‍💻' },
      { username: 'helen_doc', email: 'helen@example.com', mobile: '+1234567898', avatar: '👩‍⚕️' }
    ];

    for (const contact of randomContacts) {
      const userId = 'user-' + Date.now() + Math.random().toString(36).substr(2, 9);
      const user = {
        _id: userId,
        username: contact.username,
        email: contact.email,
        password: await bcrypt.hash('password123', 12),
        avatar: contact.avatar,
        isOnline: Math.random() > 0.5,
        lastSeen: new Date(Date.now() - Math.random() * 86400000),
        publicKey: generateKeyPair(),
        mobile: contact.mobile
      };
      users.set(userId, user);
    }

    console.log('�👥 Total users in system:', users.size);
    console.log('📱 Random contacts created with mobile numbers');
  } catch (error) {
    console.error('Error creating default users:', error);
  }
});
