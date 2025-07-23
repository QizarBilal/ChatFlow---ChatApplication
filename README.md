Designed and Owned by "Mohammed Qizar Bilal"
 
 💬 ChatFlow - Professional Real-Time Chat Application

**ChatFlow** is a modern, professional real-time chat application built with React.js, Node.js, and Socket.io. It features secure messaging, user authentication, and an intelligent chatbot assistant.

![ChatFlow Banner](https://img.shields.io/badge/ChatFlow-Professional%20Chat%20App-blue?style=for-the-badge&logo=react)

## ✨ Features

### 🔐 **Authentication & Security**
- JWT-based authentication
- Password hashing with bcrypt
- Message encryption with CryptoJS
- Secure user sessions

### 💬 **Real-Time Messaging**
- Instant messaging with Socket.io
- Direct messages between users
- Group chat rooms (General, Tech Talk, Random)
- Typing indicators
- Read receipts
- Online/offline status

### 🤖 **Intelligent ChatBot**
- **ChatFlow_Bot** welcomes new users
- Helpful tips and guidance
- Interactive assistant features

### 👥 **User Management**
- User search by username, email, or mobile number
- Contact management
- User profiles with avatars
- Mobile number support

### 🎨 **Professional UI/UX**
- Clean, corporate design
- Glassmorphism effects
- Responsive design for all devices
- Professional blue/gray color scheme
- Smooth animations and transitions

## 🛠️ Technology Stack

### **Frontend**
- ⚛️ **React.js** with TypeScript
- 🎨 **CSS3** with modern styling
- 🔌 **Socket.io Client** for real-time communication
- 📱 **Responsive Design**

### **Backend**
- 🟢 **Node.js** with Express.js
- 🔌 **Socket.io** for WebSocket connections
- 🔐 **JWT** for authentication
- 🛡️ **bcryptjs** for password hashing
- 🔒 **CryptoJS** for message encryption

## 🚀 Quick Start

### **Prerequisites**
- Node.js (v14 or higher)
- npm or yarn package manager

### **Installation**

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/chatflow.git
   cd chatflow
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install frontend dependencies
   cd frontend
   npm install
   
   # Install backend dependencies
   cd ../backend
   npm install
   cd ..
   ```

3. **Environment Setup**
   ```bash
   # Create .env file in backend directory
   echo "JWT_SECRET=your-super-secure-jwt-secret
   ENCRYPTION_KEY=your-encryption-key-here
   PORT=5000" > backend/.env
   ```

4. **Start the application**
   ```bash
   # Start both frontend and backend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 🔑 Default Login Credentials

- **Username:** `admin`
- **Password:** `password`

## 👥 Pre-loaded Users

The application comes with several demo users:
- `alice_wonder` (👩‍💼) - Business Professional
- `bob_builder` (👨‍🔧) - Technical Expert  
- `charlie_brown` (👨‍🎨) - Creative Artist
- `diana_prince` (👩‍⚖️) - Legal Professional
- `ethan_hunt` (🕵️‍♂️) - Security Specialist
- `fiona_green` (👩‍🌾) - Environmental Expert
- `george_tech` (👨‍💻) - Software Developer
- `helen_doc` (👩‍⚕️) - Medical Professional

## 📁 Project Structure

```
chatflow/
├── frontend/                 # React.js frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── contexts/         # React contexts
│   │   └── ...
│   ├── public/              # Static assets
│   └── package.json
├── backend/                 # Node.js backend
│   ├── server-memory.js     # Main server file
│   └── package.json
├── package.json            # Root package.json
├── README.md              # Project documentation
└── .gitignore            # Git ignore rules
```

## 🔧 Available Scripts

### **Root Directory**
```bash
npm run dev          # Start both frontend and backend
npm run start        # Production start
```

### **Frontend Directory**
```bash
npm start           # Start development server
npm run build       # Build for production
npm test            # Run tests
```

### **Backend Directory**
```bash
npm run dev         # Start with nodemon
npm start           # Start production server
```

## 🌟 Key Features Explained

### **Real-Time Communication**
- WebSocket connections via Socket.io
- Instant message delivery
- Live typing indicators
- Real-time online status updates

### **Security Features**
- JWT token-based authentication
- Password hashing with salt rounds
- Message encryption for sensitive data
- CORS protection

### **User Experience**
- Professional glassmorphism design
- Smooth animations and transitions
- Mobile-responsive interface
- Intuitive navigation

### **ChatBot Assistant**
- Automated welcome messages
- Helpful tips and guidance
- Interactive user onboarding

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Mohammed Qizar Bilal**
- GitHub: [@yourusername](https://github.com/QizarBilal)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/mohammed-qizar-bilal)

## 🙏 Acknowledgments

- React.js community for excellent documentation
- Socket.io for real-time communication capabilities
- The open-source community for inspiration

---

**⭐ Star this repository if you found it helpful!**

*Built by Mohammed Qizar Bilal with ❤️ and modern web technologies*
