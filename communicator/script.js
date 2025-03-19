// Navbar background change on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.background = '#141414';
    } else {
        navbar.style.background = 'linear-gradient(to bottom, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 100%)';
    }
});

// Add hover effect to video cards
document.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.transform = 'scale(1.05)';
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'scale(1)';
    });
});

// Play button click effect
document.querySelector('.play-btn').addEventListener('click', () => {
    // Add your video player logic here
    alert('Video player functionality would be implemented here');
});

// Sample data for posts
const posts = [
    {
        username: '@user',
        content: 'Crafting the perfect sample message to exactly fill 140 characters can be challenging, yet it provides an ideal test case for our app. Enjoy!',
        likes: 7,
        comments: 3,
        timeAgo: '3h ago'
    },
    {
        username: '@user',
        content: 'The quick brown fox jumps over the lazy dog',
        likes: 7,
        comments: 3,
        timeAgo: '3h ago'
    },
    {
        username: '@user',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        likes: 7,
        comments: 3,
        timeAgo: '3h ago'
    },
    {
        username: '@user',
        content: 'Yo',
        likes: 7,
        comments: 3,
        timeAgo: '3h ago'
    },
    {
        username: '@user',
        content: 'What is this',
        likes: 7,
        comments: 3,
        timeAgo: '3h ago'
    }
];

// Sample data for online users
const onlineUsers = [
    '@user', '@user1', '@user2', '@user3', '@user4', '@user5', 
    '@user6', '@user7'
];

// Sample data for streams
const streams = [
    {
        title: 'Nets at Celtics',
        viewers: '613 viewers',
        channel: 'NBA TV',
        endsAt: 'Ends at 11:00am'
    },
    {
        title: 'Nets at Celtics',
        viewers: '613 viewers',
        channel: 'NBA TV',
        endsAt: 'Ends at 11:00am'
    },
    {
        title: 'Nets at Celtics',
        viewers: '613 viewers',
        channel: 'NBA TV',
        endsAt: 'Ends at 11:00am'
    }
];

// Function to create a post element
function createPostElement(post) {
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.innerHTML = `
        <div class="post-header">
            <img src="placeholder-avatar.png" alt="User avatar" class="post-avatar">
            <div class="post-meta">
                <span class="post-username">${post.username}</span>
                <span class="post-time">${post.timeAgo}</span>
            </div>
        </div>
        <div class="post-content">${post.content}</div>
        <div class="post-actions">
            <button class="like-btn">❤️ ${post.likes}</button>
            <button class="comment-btn">💬 ${post.comments}</button>
            <button class="more-btn">⋯</button>
        </div>
    `;
    return postElement;
}

// Function to create a user element
function createUserElement(username) {
    const userElement = document.createElement('div');
    userElement.className = 'user-item';
    userElement.innerHTML = `
        <img src="placeholder-avatar.png" alt="User avatar">
        <span>${username}</span>
    `;
    return userElement;
}

// Function to create a stream element
function createStreamElement(stream) {
    const streamElement = document.createElement('div');
    streamElement.className = 'stream-item';
    streamElement.innerHTML = `
        <div class="stream-preview">
            <img src="placeholder-stream.png" alt="Stream preview">
            <span class="viewers">${stream.viewers}</span>
        </div>
        <div class="stream-info">
            <h3>${stream.title}</h3>
            <p>${stream.channel}</p>
            <p>${stream.endsAt}</p>
        </div>
    `;
    return streamElement;
}

// Initialize the page
function initializePage() {
    const postsFeed = document.querySelector('.posts-feed');
    const userList = document.querySelector('.user-list');
    const streamList = document.querySelector('.stream-list');

    // Add posts
    posts.forEach(post => {
        postsFeed.appendChild(createPostElement(post));
    });

    // Add online users
    onlineUsers.forEach(user => {
        userList.appendChild(createUserElement(user));
    });

    // Add streams
    streams.forEach(stream => {
        streamList.appendChild(createStreamElement(stream));
    });
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initializePage);

// Socket.IO connection
const socket = io(window.location.origin);

// Authentication handling
let currentUser = null;

function showAuthPrompt() {
    const authHtml = `
        <div class="auth-overlay">
            <div class="auth-modal">
                <h2>Welcome to Communicator</h2>
                <div class="auth-options">
                    <div class="auth-option">
                        <h3>Have a session ID?</h3>
                        <input type="text" id="session-id" placeholder="Enter your 16-digit session ID">
                        <button onclick="loginWithSession()">Login</button>
                    </div>
                    <div class="auth-separator">or</div>
                    <div class="auth-option">
                        <h3>Create new account</h3>
                        <input type="text" id="new-username" placeholder="Choose a username">
                        <input type="text" id="profile-picture" placeholder="Profile picture URL (optional)">
                        <button onclick="createNewAccount()">Create Account</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', authHtml);
}

function loginWithSession() {
    const sessionId = document.getElementById('session-id').value.trim();
    if (sessionId.length !== 16 || !/^\d+$/.test(sessionId)) {
        alert('Please enter a valid 16-digit session ID');
        return;
    }
    socket.emit('auth', { type: 'session', sessionId });
}

function createNewAccount() {
    const username = document.getElementById('new-username').value.trim();
    const profilePicture = document.getElementById('profile-picture').value.trim();
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    socket.emit('auth', {
        type: 'new',
        username,
        profilePicture: profilePicture || null
    });
}

// Socket event handlers
socket.on('auth_success', (user) => {
    currentUser = user;
    document.querySelector('.auth-overlay')?.remove();
    document.querySelector('.user-profile img').src = user.profilePicture;
    document.querySelector('.user-profile span').textContent = user.username;

    // Show session ID for new users
    if (user.isNew) {
        alert(`Your session ID is: ${user.sessionId}\nPlease save this number to log in later!`);
    }
});

socket.on('auth_error', (error) => {
    alert(error.message);
});

socket.on('initial_posts', (posts) => {
    const postsFeed = document.querySelector('.posts-feed');
    postsFeed.innerHTML = '';
    posts.forEach(post => {
        postsFeed.appendChild(createPostElement(post));
    });
});

socket.on('online_users', (users) => {
    const userList = document.querySelector('.user-list');
    userList.innerHTML = '';
    users.forEach(user => {
        userList.appendChild(createUserElement(user));
    });
    document.querySelector('.online-count').textContent = users.length;
});

socket.on('new_post', (post) => {
    const postElement = createPostElement(post);
    const postsFeed = document.querySelector('.posts-feed');
    postsFeed.insertBefore(postElement, postsFeed.firstChild);
});

socket.on('post_liked', (data) => {
    const postElement = document.querySelector(`[data-post-id="${data.postId}"]`);
    if (postElement) {
        const likeCount = postElement.querySelector('.like-count');
        likeCount.textContent = parseInt(likeCount.textContent) + 1;
    }
});

socket.on('new_comment', (comment) => {
    const postElement = document.querySelector(`[data-post-id="${comment.postId}"]`);
    if (postElement) {
        const commentCount = postElement.querySelector('.comment-count');
        commentCount.textContent = parseInt(commentCount.textContent) + 1;
    }
});

socket.on('new_message', (message) => {
    // Show notification for new message
    const notification = document.createElement('div');
    notification.className = 'message-notification';
    notification.textContent = `New message from ${message.senderUsername}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);

    // Update message count in nav
    const messageCount = document.querySelector('.message-count');
    messageCount.textContent = parseInt(messageCount.textContent) + 1;
});

// Post creation and interaction handlers
const textarea = document.querySelector('.post-composer textarea');
const postBtn = document.querySelector('.post-btn');

function handleTextareaInput() {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
    
    // Show character count
    const charCount = textarea.value.length;
    postBtn.textContent = charCount > 0 ? `post (${charCount}/140)` : 'post';
    postBtn.disabled = charCount > 140;
}

function handlePostSubmit() {
    const content = textarea.value.trim();
    if (content && content.length <= 140) {
        socket.emit('new_post', { content });
        textarea.value = '';
        textarea.style.height = 'auto';
        postBtn.textContent = 'post';
    }
}

// Event listeners
textarea.addEventListener('input', handleTextareaInput);
postBtn.addEventListener('click', handlePostSubmit);

// Post interactions
document.querySelector('.posts-feed').addEventListener('click', (e) => {
    if (!currentUser) return;

    const postElement = e.target.closest('.post');
    if (!postElement) return;

    const postId = postElement.dataset.postId;

    if (e.target.classList.contains('like-btn')) {
        socket.emit('like_post', postId);
    } else if (e.target.classList.contains('comment-btn')) {
        const content = prompt('Enter your comment:');
        if (content) {
            socket.emit('new_comment', { postId, content });
        }
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    showAuthPrompt();
}); 