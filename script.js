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
    postElement.dataset.id = post.id;

    let content = post.content;
    // Replace mentions with links
    content = content.replace(/@(\w+)/g, '<a href="#" class="mention">@$1</a>');
    // Replace GIF tags with actual GIFs
    content = content.replace(/\[GIF\](.*?)\[\/GIF\]/g, '<img src="$1" class="post-gif" alt="GIF">');

    postElement.innerHTML = `
        <div class="post-header">
            <img src="${post.profile_picture}" alt="${post.username}" class="avatar">
            <span class="username">${post.username}</span>
            <span class="time">${post.timeAgo}</span>
        </div>
        <div class="post-content">${content}</div>
        ${post.imageUrl ? `<img src="${post.imageUrl}" class="post-image" alt="Post image">` : ''}
        ${post.pollId ? createPollElement(post) : ''}
        <div class="post-actions">
            <button class="like-btn">❤️ ${post.likes_count || 0}</button>
            <button class="comment-btn">💬 ${post.comments_count || 0}</button>
            <button class="share-btn">🔄</button>
        </div>
    `;

    // Add event listeners
    postElement.querySelector('.like-btn').addEventListener('click', () => {
        socket.emit('like_post', post.id);
    });

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

// DOM Elements
const postComposer = document.querySelector('.post-composer');
const postTextarea = postComposer.querySelector('textarea');
const characterCount = postComposer.querySelector('.character-count');
const pollForm = postComposer.querySelector('.poll-form');
const gifForm = postComposer.querySelector('.gif-form');
const pollOptions = pollForm.querySelector('.poll-options');
const addOptionBtn = pollForm.querySelector('.add-option-btn');
const createPollBtn = pollForm.querySelector('.create-poll-btn');
const gifSearch = gifForm.querySelector('.gif-search');
const gifResults = gifForm.querySelector('.gif-results');

// Character count update
postTextarea.addEventListener('input', () => {
    const remaining = 140 - postTextarea.value.length;
    characterCount.textContent = remaining;
    characterCount.style.color = remaining < 20 ? 'red' : 'inherit';
});

// Poll form handling
document.querySelector('.poll-btn').addEventListener('click', () => {
    pollForm.style.display = 'block';
    gifForm.style.display = 'none';
});

addOptionBtn.addEventListener('click', () => {
    if (pollOptions.children.length < 4) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'poll-option';
        input.placeholder = `Option ${pollOptions.children.length + 1}`;
        pollOptions.appendChild(input);
    }
});

createPollBtn.addEventListener('click', () => {
    const question = pollForm.querySelector('.poll-question').value.trim();
    const options = Array.from(pollOptions.querySelectorAll('input'))
        .map(input => input.value.trim())
        .filter(option => option !== '');

    if (question && options.length >= 2) {
        socket.emit('create_poll', {
            question,
            options
        });
        pollForm.style.display = 'none';
        pollForm.querySelector('.poll-question').value = '';
        pollOptions.innerHTML = `
            <input type="text" class="poll-option" placeholder="Option 1">
            <input type="text" class="poll-option" placeholder="Option 2">
        `;
    }
});

// GIF form handling
document.querySelector('.gif-btn').addEventListener('click', () => {
    gifForm.style.display = 'block';
    pollForm.style.display = 'none';
});

let gifSearchTimeout;
gifSearch.addEventListener('input', () => {
    clearTimeout(gifSearchTimeout);
    gifSearchTimeout = setTimeout(() => {
        const query = gifSearch.value.trim();
        if (query) {
            // Using GIPHY API (you'll need to add your API key)
            fetch(`https://api.giphy.com/v1/gifs/search?api_key=YOUR_GIPHY_API_KEY&q=${encodeURIComponent(query)}&limit=10`)
                .then(response => response.json())
                .then(data => {
                    gifResults.innerHTML = data.data.map(gif => `
                        <div class="gif-item" data-url="${gif.images.fixed_height.url}">
                            <img src="${gif.images.fixed_height_small.url}" alt="${gif.title}">
                        </div>
                    `).join('');
                });
        } else {
            gifResults.innerHTML = '';
        }
    }, 500);
});

gifResults.addEventListener('click', (e) => {
    const gifItem = e.target.closest('.gif-item');
    if (gifItem) {
        const gifUrl = gifItem.dataset.url;
        postTextarea.value += `\n[GIF]${gifUrl}[/GIF]\n`;
        gifForm.style.display = 'none';
        gifSearch.value = '';
        gifResults.innerHTML = '';
    }
});

// Post handling
document.querySelector('.post-btn').addEventListener('click', () => {
    const content = postTextarea.value.trim();
    if (content) {
        socket.emit('new_post', { content });
        postTextarea.value = '';
        characterCount.textContent = '140';
    }
});

// Create poll element
function createPollElement(post) {
    return `
        <div class="poll" data-poll-id="${post.pollId}">
            <div class="poll-question">${post.content}</div>
            <div class="poll-options">
                ${post.pollOptions.map((option, index) => `
                    <div class="poll-option" data-option-id="${option.id}">
                        <div class="option-text">${option.text}</div>
                        <div class="option-bar">
                            <div class="option-fill" style="width: ${(option.votes / post.pollOptions.reduce((sum, opt) => sum + opt.votes, 0)) * 100}%"></div>
                        </div>
                        <div class="option-votes">${option.votes} votes</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
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

socket.on('post_liked', ({ postId, userId }) => {
    const post = document.querySelector(`.post[data-id="${postId}"]`);
    if (post) {
        const likeBtn = post.querySelector('.like-btn');
        const currentLikes = parseInt(likeBtn.textContent.split(' ')[1]) || 0;
        likeBtn.textContent = `❤️ ${currentLikes + 1}`;
    }
});

socket.on('new_comment', (comment) => {
    const post = document.querySelector(`.post[data-id="${comment.postId}"]`);
    if (post) {
        const commentBtn = post.querySelector('.comment-btn');
        const currentComments = parseInt(commentBtn.textContent.split(' ')[1]) || 0;
        commentBtn.textContent = `💬 ${currentComments + 1}`;
    }
});

socket.on('poll_updated', ({ pollId, options }) => {
    const poll = document.querySelector(`.poll[data-poll-id="${pollId}"]`);
    if (poll) {
        const totalVotes = options.reduce((sum, opt) => sum + opt.votes, 0);
        options.forEach(option => {
            const optionElement = poll.querySelector(`.poll-option[data-option-id="${option.id}"]`);
            if (optionElement) {
                optionElement.querySelector('.option-fill').style.width = 
                    `${(option.votes / totalVotes) * 100}%`;
                optionElement.querySelector('.option-votes').textContent = 
                    `${option.votes} votes`;
            }
        });
    }
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