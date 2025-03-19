const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const admin = require('firebase-admin');

// Initialize Firebase Admin
let db;
try {
  // Generate a unique app name based on timestamp and random string
  const appName = `app-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  // Check if Firebase is already initialized with this app name
  if (!admin.apps.find(app => app.name === appName)) {
    // Get the service account from environment variable
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountString) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
    }

    // Parse the service account JSON
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountString);
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError);
      throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT JSON format');
    }

    // Validate required fields
    const requiredFields = ['project_id', 'private_key', 'client_email'];
    const missingFields = requiredFields.filter(field => !serviceAccount[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in service account: ${missingFields.join(', ')}`);
    }

    // Initialize Firebase Admin with unique app name
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    }, appName);
    console.log(`Firebase initialized successfully with app name: ${appName}`);
  } else {
    console.log(`Firebase already initialized with app name: ${appName}`);
  }

  // Initialize Realtime Database using the named app
  db = admin.app(appName).database();
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Log the error but don't exit the process in production
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Add a health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', firebase: !!db });
});

// Helper function to get Firebase ref with error handling
const getRef = (path) => {
  if (!db) {
    throw new Error('Firebase database not initialized');
  }
  return db.ref(path);
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New client connected');

  // Handle user authentication
  socket.on('authenticate', async (data) => {
    if (!db) {
      socket.emit('auth_error', { message: 'Database not initialized' });
      return;
    }

    const { username, sessionId } = data;
    const userRef = getRef(`users/${username}`);
    
    try {
      const snapshot = await userRef.once('value');
      const userData = snapshot.val();
      
      if (userData && userData.sessionId === sessionId) {
        socket.username = username;
        socket.emit('auth_success', { username, profilePicture: userData.profilePicture });
        
        // Send initial data
        const postsSnapshot = await getRef('posts').orderByChild('timestamp').limitToLast(50).once('value');
        const posts = [];
        postsSnapshot.forEach((childSnapshot) => {
          posts.push({ id: childSnapshot.key, ...childSnapshot.val() });
        });
        socket.emit('initial_data', { posts });
      } else {
        socket.emit('auth_error', { message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  });

  // Handle new user registration
  socket.on('register', async (data) => {
    const { username, profilePicture } = data;
    const sessionId = uuidv4().replace(/-/g, '');
    const userRef = getRef(`users/${username}`);
    
    try {
      const snapshot = await userRef.once('value');
      if (snapshot.exists()) {
        socket.emit('register_error', { message: 'Username already taken' });
        return;
      }

      await userRef.set({
        username,
        profilePicture: profilePicture || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        sessionId,
        createdAt: Date.now()
      });

      socket.username = username;
      socket.emit('register_success', { username, sessionId, profilePicture });
    } catch (error) {
      console.error('Registration error:', error);
      socket.emit('register_error', { message: 'Registration failed' });
    }
  });

  // Handle new post creation
  socket.on('new_post', async (data) => {
    if (!socket.username) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { content, imageUrl, gifUrl } = data;
    const postRef = getRef('posts').push();
    
    try {
      const post = {
        content,
        imageUrl,
        gifUrl,
        username: socket.username,
        timestamp: Date.now(),
        likes: 0,
        comments: []
      };

      await postRef.set(post);
      io.emit('new_post', { id: postRef.key, ...post });
    } catch (error) {
      console.error('Post creation error:', error);
      socket.emit('error', { message: 'Failed to create post' });
    }
  });

  // Handle post likes
  socket.on('like_post', async (data) => {
    if (!socket.username) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { postId } = data;
    const postRef = getRef(`posts/${postId}`);
    
    try {
      const snapshot = await postRef.once('value');
      const post = snapshot.val();
      
      if (post) {
        await postRef.update({
          likes: (post.likes || 0) + 1
        });
        
        io.emit('post_liked', { postId, likes: (post.likes || 0) + 1 });
      }
    } catch (error) {
      console.error('Like error:', error);
      socket.emit('error', { message: 'Failed to like post' });
    }
  });

  // Handle comments
  socket.on('comment', async (data) => {
    if (!socket.username) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { postId, content } = data;
    const postRef = getRef(`posts/${postId}`);
    
    try {
      const snapshot = await postRef.once('value');
      const post = snapshot.val();
      
      if (post) {
        const comment = {
          id: uuidv4(),
          content,
          username: socket.username,
          timestamp: Date.now()
        };

        const comments = [...(post.comments || []), comment];
        await postRef.update({ comments });
        
        io.emit('new_comment', { postId, comment });
      }
    } catch (error) {
      console.error('Comment error:', error);
      socket.emit('error', { message: 'Failed to add comment' });
    }
  });

  // Handle direct messages
  socket.on('send_message', async (data) => {
    if (!socket.username) {
      socket.emit('error', { message: 'Not authenticated' });
      return;
    }

    const { recipient, content } = data;
    const messageRef = getRef('messages').push();
    
    try {
      const message = {
        sender: socket.username,
        recipient,
        content,
        timestamp: Date.now(),
        read: false
      };

      await messageRef.set(message);
      
      // Emit to recipient if online
      const recipientSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.username === recipient);
      
      if (recipientSocket) {
        recipientSocket.emit('new_message', message);
      }
    } catch (error) {
      console.error('Message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Firebase status: ${db ? 'initialized' : 'not initialized'}`);
}); 