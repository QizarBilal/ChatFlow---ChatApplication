const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
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

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Create sample data when connected
mongoose.connection.once('open', async () => {
  console.log('Connected to MongoDB');
  
  // Create default rooms if they don't exist
  try {
    const existingRooms = await Room.find();
    if (existingRooms.length === 0) {
      console.log('Creating default rooms...');
      
      const defaultRooms = [
        {
          name: 'General',
          description: 'General discussion for everyone',
          isPrivate: false,
          members: [],
          admin: null
        },
        {
          name: 'Tech Talk',
          description: 'Discuss technology and programming',
          isPrivate: false,
          members: [],
          admin: null
        },
        {
          name: 'Random',
          description: 'Random conversations and fun',
          isPrivate: false,
          members: [],
          admin: null
        }
      ];

      await Room.insertMany(defaultRooms);
      console.log('Default rooms created successfully');
    }
  } catch (error) {
    console.error('Error creating default rooms:', error);
  }
});

// Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  publicKey: { type: String, required: true }
});

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isPrivate: { type: Boolean, default: false },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
  content: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  messageType: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
  isEncrypted: { type: Boolean, default: true },
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    readAt: { type: Date, default: Date.now }
  }],
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Room = mongoose.model('Room', roomSchema);
const Message = mongoose.model('Message', messageSchema);

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

// Generate key pair for encryption
const generateKeyPair = () => {
  return CryptoJS.lib.WordArray.random(256/8).toString();
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
    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Generate public key for encryption
    const publicKey = generateKeyPair();

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      publicKey
    });

    await user.save();

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
        publicKey: user.publicKey
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

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Update online status
    user.isOnline = true;
    await user.save();

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
    const rooms = await Room.find({
      members: req.user.userId
    }).populate('members', 'username avatar isOnline');

    res.json(rooms);
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;

    const room = new Room({
      name,
      description,
      isPrivate,
      members: [req.user.userId],
      admin: req.user.userId
    });

    await room.save();
    await room.populate('members', 'username avatar isOnline');

    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/messages/:roomId', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const messages = await Message.find({ room: roomId })
      .populate('sender', 'username avatar')
      .populate('readBy.user', 'username')
      .sort({ timestamp: -1 })
      .limit(50);

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user.userId }
    }).select('username avatar isOnline lastSeen');

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Socket.io connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('join', async (userData) => {
    try {
      const user = await User.findById(userData.userId);
      if (user) {
        user.isOnline = true;
        await user.save();
        
        connectedUsers.set(socket.id, {
          userId: userData.userId,
          username: userData.username
        });

        // Join user's rooms
        const userRooms = await Room.find({ members: userData.userId });
        userRooms.forEach(room => {
          socket.join(room._id.toString());
        });

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

      const message = new Message({
        content: encryptedContent,
        sender: userData.userId,
        room: roomId || null,
        recipient: recipientId || null,
        messageType,
        isEncrypted: true
      });

      await message.save();
      await message.populate('sender', 'username avatar');

      // Decrypt for sending to clients
      const decryptedMessage = {
        ...message.toObject(),
        content: content // Send original content to clients
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

      await Message.findByIdAndUpdate(messageId, {
        $addToSet: {
          readBy: {
            user: userData.userId,
            readAt: new Date()
          }
        }
      });

      socket.broadcast.emit('messageRead', {
        messageId,
        userId: userData.userId,
        readAt: new Date()
      });

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
        const user = await User.findById(userData.userId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          await user.save();
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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
