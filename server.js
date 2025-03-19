const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Database setup
const db = new sqlite3.Database('communicator.db');

// Create tables if they don't exist
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        profile_picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Posts table
    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        content TEXT,
        image_url TEXT,
        gif_url TEXT,
        poll_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Mentions table
    db.run(`CREATE TABLE IF NOT EXISTS mentions (
        post_id TEXT,
        mentioned_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(post_id, mentioned_user_id),
        FOREIGN KEY(post_id) REFERENCES posts(id),
        FOREIGN KEY(mentioned_user_id) REFERENCES users(id)
    )`);

    // Likes table
    db.run(`CREATE TABLE IF NOT EXISTS likes (
        post_id TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(post_id, user_id),
        FOREIGN KEY(post_id) REFERENCES posts(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Comments table
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        user_id TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(post_id) REFERENCES posts(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Direct Messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        receiver_id TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id)
    )`);

    // Polls table
    db.run(`CREATE TABLE IF NOT EXISTS polls (
        id TEXT PRIMARY KEY,
        question TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Poll Options table
    db.run(`CREATE TABLE IF NOT EXISTS poll_options (
        id TEXT PRIMARY KEY,
        poll_id TEXT,
        option_text TEXT,
        votes INTEGER DEFAULT 0,
        FOREIGN KEY(poll_id) REFERENCES polls(id)
    )`);

    // Poll Votes table
    db.run(`CREATE TABLE IF NOT EXISTS poll_votes (
        poll_id TEXT,
        option_id TEXT,
        user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(poll_id, user_id),
        FOREIGN KEY(poll_id) REFERENCES polls(id),
        FOREIGN KEY(option_id) REFERENCES poll_options(id),
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connected users map
const connectedUsers = new Map();

// Helper function to extract mentions from content
function extractMentions(content) {
    const mentionRegex = /@(\w+)/g;
    const mentions = content.match(mentionRegex) || [];
    return mentions.map(mention => mention.slice(1)); // Remove @ symbol
}

// WebSocket connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle authentication
    socket.on('auth', async (data) => {
        try {
            if (data.type === 'session') {
                // Check existing session ID
                db.get('SELECT * FROM users WHERE id = ?', [data.sessionId], (err, user) => {
                    if (err || !user) {
                        socket.emit('auth_error', { message: 'Invalid session ID' });
                    } else {
                        handleSuccessfulAuth(socket, user);
                    }
                });
            } else if (data.type === 'new') {
                // Create new account
                const sessionId = generateSessionId();
                const username = data.username;
                const profilePicture = data.profilePicture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + username;

                db.run('INSERT INTO users (id, username, profile_picture) VALUES (?, ?, ?)',
                    [sessionId, username, profilePicture],
                    (err) => {
                        if (err) {
                            socket.emit('auth_error', { message: 'Username already taken' });
                        } else {
                            handleSuccessfulAuth(socket, { id: sessionId, username, profile_picture: profilePicture });
                        }
                    }
                );
            }
        } catch (error) {
            socket.emit('auth_error', { message: 'Authentication failed' });
        }
    });

    // Handle new post
    socket.on('new_post', async (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        if (data.content.length > 140) {
            socket.emit('post_error', { message: 'Post exceeds 140 characters' });
            return;
        }

        const postId = uuidv4();
        const mentions = extractMentions(data.content);

        db.run('INSERT INTO posts (id, user_id, content, image_url, gif_url) VALUES (?, ?, ?, ?, ?)',
            [postId, user.id, data.content, data.imageUrl || null, data.gifUrl || null],
            (err) => {
                if (err) {
                    socket.emit('post_error', { message: 'Failed to create post' });
                } else {
                    // Handle mentions
                    if (mentions.length > 0) {
                        mentions.forEach(mentionedUsername => {
                            db.get('SELECT id FROM users WHERE username = ?', [mentionedUsername], (err, mentionedUser) => {
                                if (!err && mentionedUser) {
                                    db.run('INSERT INTO mentions (post_id, mentioned_user_id) VALUES (?, ?)',
                                        [postId, mentionedUser.id]);
                                }
                            });
                        });
                    }

                    const post = {
                        id: postId,
                        username: user.username,
                        content: data.content,
                        imageUrl: data.imageUrl,
                        gifUrl: data.gifUrl,
                        likes: 0,
                        comments: 0,
                        timeAgo: 'just now'
                    };
                    io.emit('new_post', post);
                }
            }
        );
    });

    // Handle poll creation
    socket.on('create_poll', async (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const pollId = uuidv4();
        const postId = uuidv4();

        db.run('INSERT INTO polls (id, question) VALUES (?, ?)',
            [pollId, data.question],
            (err) => {
                if (err) {
                    socket.emit('poll_error', { message: 'Failed to create poll' });
                } else {
                    // Insert poll options
                    data.options.forEach(option => {
                        const optionId = uuidv4();
                        db.run('INSERT INTO poll_options (id, poll_id, option_text) VALUES (?, ?, ?)',
                            [optionId, pollId, option]);
                    });

                    // Create post with poll
                    db.run('INSERT INTO posts (id, user_id, content, poll_id) VALUES (?, ?, ?, ?)',
                        [postId, user.id, data.question, pollId],
                        (err) => {
                            if (!err) {
                                const post = {
                                    id: postId,
                                    username: user.username,
                                    content: data.question,
                                    pollId: pollId,
                                    options: data.options,
                                    votes: data.options.map(() => 0),
                                    likes: 0,
                                    comments: 0,
                                    timeAgo: 'just now'
                                };
                                io.emit('new_post', post);
                            }
                        }
                    );
                }
            }
        );
    });

    // Handle poll vote
    socket.on('vote_poll', async (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        db.run('INSERT OR IGNORE INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)',
            [data.pollId, data.optionId, user.id],
            (err) => {
                if (!err) {
                    // Update vote count
                    db.run('UPDATE poll_options SET votes = votes + 1 WHERE id = ?',
                        [data.optionId]);
                    
                    // Get updated poll data
                    db.all('SELECT * FROM poll_options WHERE poll_id = ?', [data.pollId],
                        (err, options) => {
                            if (!err) {
                                io.emit('poll_updated', {
                                    pollId: data.pollId,
                                    options: options
                                });
                            }
                        }
                    );
                }
            }
        );
    });

    // Handle like
    socket.on('like_post', (postId) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        db.run('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)',
            [postId, user.id],
            (err) => {
                if (!err) {
                    io.emit('post_liked', { postId, userId: user.id });
                }
            }
        );
    });

    // Handle comment
    socket.on('new_comment', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const commentId = uuidv4();
        db.run('INSERT INTO comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)',
            [commentId, data.postId, user.id, data.content],
            (err) => {
                if (!err) {
                    io.emit('new_comment', {
                        id: commentId,
                        postId: data.postId,
                        username: user.username,
                        content: data.content
                    });
                }
            }
        );
    });

    // Handle direct message
    socket.on('direct_message', (data) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        const messageId = uuidv4();
        db.run('INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
            [messageId, user.id, data.receiverId, data.content],
            (err) => {
                if (!err) {
                    // Find receiver's socket and send message
                    const receiverSocket = [...connectedUsers.entries()]
                        .find(([_, u]) => u.id === data.receiverId)?.[0];
                    
                    if (receiverSocket) {
                        io.to(receiverSocket).emit('new_message', {
                            id: messageId,
                            senderId: user.id,
                            senderUsername: user.username,
                            content: data.content
                        });
                    }
                }
            }
        );
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            connectedUsers.delete(socket.id);
            io.emit('user_offline', { userId: user.id });
        }
    });
});

// Helper functions
function generateSessionId() {
    return Math.random().toString().slice(2, 18); // 16-digit number
}

function handleSuccessfulAuth(socket, user) {
    connectedUsers.set(socket.id, user);
    socket.emit('auth_success', { 
        sessionId: user.id,
        username: user.username,
        profilePicture: user.profile_picture
    });

    // Send initial data
    sendInitialData(socket, user);
}

function sendInitialData(socket, user) {
    // Send recent posts with all details
    db.all(`
        SELECT 
            p.*, 
            u.username, 
            u.profile_picture,
            (SELECT COUNT(*) FROM likes WHERE post_id = p.id) as likes_count,
            (SELECT COUNT(*) FROM comments WHERE post_id = p.id) as comments_count,
            CASE 
                WHEN p.poll_id IS NOT NULL THEN (
                    SELECT json_group_array(
                        json_object(
                            'id', po.id,
                            'text', po.option_text,
                            'votes', po.votes
                        )
                    )
                    FROM poll_options po
                    WHERE po.poll_id = p.poll_id
                )
                ELSE NULL
            END as poll_options
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 50
    `, [], (err, posts) => {
        if (!err) {
            // Process posts to include poll data
            const processedPosts = posts.map(post => ({
                ...post,
                pollOptions: post.poll_options ? JSON.parse(post.poll_options) : null
            }));
            socket.emit('initial_posts', processedPosts);
        }
    });

    // Send online users
    const onlineUsers = Array.from(connectedUsers.values()).map(u => ({
        id: u.id,
        username: u.username,
        profilePicture: u.profile_picture
    }));
    socket.emit('online_users', onlineUsers);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 