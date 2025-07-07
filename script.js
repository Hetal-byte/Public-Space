// Global variable for the current logged-in user
let currentUser = {
    username: null,
    friendCount: 0,
    postsToday: 0, // This will be updated based on server response
    friends: []
};

// Base URL for your API
const API_BASE_URL = 'https://public-space-1-wqg6.onrender.com/api';

// DOM Elements (check if they exist before using, as some are page-specific)
const splashScreen = document.getElementById('splash-screen');

// Home page specific DOM elements (initialized only if they exist)
const friendCountEl = document.getElementById('friend-count');
const addFriendsBtn = document.getElementById('add-friends-btn');
const friendsPopup = document.getElementById('friends-popup');
const friendsListEl = document.getElementById('friend-suggestions'); // People You May Know
const currentFriendsEl = document.getElementById('friends-grid'); // Your Friends
const profilePopup = document.getElementById('profile-popup');
const profileFriendCountEl = document.getElementById('profile-friend-count');
const profilePostCountEl = document.getElementById('profile-post-count');
const postContent = document.getElementById('post-content');
const postBtn = document.getElementById('post-btn');
const mediaUploadInput = document.getElementById('media-upload');
const uploadBtn = document.getElementById('upload-btn');
const mediaPreview = document.getElementById('media-preview');
const feedContainer = document.querySelector('.feed'); // Container for posts

// New DOM elements for posting restrictions
const noFriendsAlert = document.getElementById('no-friends-alert');
const dailyLimitAlert = document.getElementById('daily-limit-alert');
const uploadContainer = document.getElementById('upload-container');
const postLimitInfo = document.getElementById('post-limit-info');

// Helper function to get post limit based on friend count (frontend version)
// This should mirror the backend's logic
function getPostLimit(friendCount) {
    if (friendCount === 0) return 0;
    if (friendCount === 1) return 1;
    if (friendCount === 2) return 2;
    if (friendCount > 10) return Infinity;
    return 2; // Default for 3-10 friends, assuming 2 posts per day
}

// Initialize app (called when DOM is loaded)
document.addEventListener('DOMContentLoaded', () => {
    // --- Splash Screen Logic (for index.html) ---
    if (splashScreen) {
        setTimeout(() => {
            splashScreen.classList.add('fade-out');
            splashScreen.addEventListener('transitionend', () => {
                window.location.href = 'login.html';
            });
        }, 3000); // 3 seconds splash
    }

    // --- Authentication Page Logic (for login.html) ---
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authErrorMessage = document.getElementById('auth-error-message');

    if (loginTab && signupTab && loginForm && signupForm) {
        loginTab.addEventListener('click', () => {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            loginForm.style.display = 'block';
            signupForm.style.display = 'none';
            authErrorMessage.textContent = ''; // Clear error message
        });

        signupTab.addEventListener('click', () => {
            signupTab.classList.add('active');
            loginTab.classList.remove('active');
            signupForm.style.display = 'block';
            loginForm.style.display = 'none';
            authErrorMessage.textContent = ''; // Clear error message
        });

        const loginBtn = document.getElementById('login-btn');
        const signupBtn = document.getElementById('signup-btn');

        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;

                try {
                    const response = await fetch(`${API_BASE_URL}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();

                    if (data.success) {
                        localStorage.setItem('loggedInUser', username); // Store username
                        window.location.href = 'home.html'; // Redirect to home page
                    } else {
                        authErrorMessage.textContent = data.error || 'Login failed.';
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    authErrorMessage.textContent = 'Network error or server unavailable.';
                }
            });
        }

        if (signupBtn) {
            signupBtn.addEventListener('click', async () => {
                const username = document.getElementById('signup-username').value;
                const password = document.getElementById('signup-password').value;
                const confirmPassword = document.getElementById('signup-confirm-password').value;

                if (password !== confirmPassword) {
                    authErrorMessage.textContent = 'Passwords do not match.';
                    return;
                }
                if (username.length < 3 || password.length < 6) {
                    authErrorMessage.textContent = 'Username must be at least 3 chars, password 6 chars.';
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    const data = await response.json();

                    if (data.success) {
                        authErrorMessage.textContent = 'Registration successful! Please log in.';
                        loginTab.click(); // Switch to login tab
                    } else {
                        authErrorMessage.textContent = data.error || 'Registration failed.';
                    }
                } catch (error) {
                    console.error('Registration error:', error);
                    authErrorMessage.textContent = 'Network error or server unavailable.';
                }
            });
        }
    }

    // --- Home Page Specific Logic (only if on home.html) ---
    // Check if we are on the home page by looking for specific elements
    if (document.body.classList.contains('home-page') || document.getElementById('friend-count')) {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (!loggedInUser) {
            // If no user is logged in, redirect to login page
            window.location.href = 'login.html';
            return;
        }
        currentUser.username = loggedInUser;
        // Ensure profile-name element exists before setting textContent
        const profileNameEl = document.getElementById('profile-name');
        if (profileNameEl) {
            profileNameEl.textContent = currentUser.username;
        }

        initHomePage();
    }
});

async function initHomePage() {
    await fetchUserData(); // Fetch friends and postsToday count
    updateFriendUI(); // Update UI based on fetched data
    setupEventListeners(); // Set up all event listeners
    fetchAndRenderPosts(); // Fetch and render all posts
}

async function fetchUserData() {
    try {
        // Fetch friends
        const friendsResponse = await fetch(`${API_BASE_URL}/friends/${currentUser.username}`);
        const friendsData = await friendsResponse.json();
        if (friendsData.friends) {
            currentUser.friends = friendsData.friends.map(name => ({ id: name, name: name })); // Convert names to objects
            currentUser.friendCount = currentUser.friends.length;
        }

        // Fetch all posts to determine postsToday for the current user
        const allPostsResponse = await fetch(`${API_BASE_URL}/posts`);
        const allPostsData = await allPostsResponse.json();
        const today = new Date().toISOString().slice(0, 10);
        currentUser.postsToday = allPostsData.posts.filter(p => p.username === currentUser.username && p.createdAt.startsWith(today)).length;

    } catch (error) {
        console.error('Error fetching user data:', error);
        // Handle error gracefully, e.g., show a message to the user
    }
}

// Update UI based on friend count and post limits
function updateFriendUI() {
    if (!friendCountEl) return; // Ensure we are on the home page

    friendCountEl.textContent = `${currentUser.friendCount} friends`;
    profileFriendCountEl.textContent = currentUser.friendCount;
    profilePostCountEl.textContent = currentUser.postsToday; // Update profile post count

    // Update "Your Friends" grid
    const noFriendsMessageEl = document.getElementById('no-friends-message');
    if (currentUser.friends.length > 0) {
        currentFriendsEl.innerHTML = ''; // Clear existing friends
        currentUser.friends.forEach(friend => {
            const friendEl = document.createElement('div');
            friendEl.className = 'friend-card';
            friendEl.innerHTML = `
                <span>${friend.name}</span>
                <button class="remove-friend-btn" data-id="${friend.name}"><i class="fas fa-user-minus"></i> Remove</button>
            `;
            currentFriendsEl.appendChild(friendEl);
        });
        if (noFriendsMessageEl) noFriendsMessageEl.style.display = 'none';
    } else {
        currentFriendsEl.innerHTML = ''; // Ensure it's empty if no friends
        if (noFriendsMessageEl) noFriendsMessageEl.style.display = 'block';
    }

    // Handle posting restrictions
    const postLimit = getPostLimit(currentUser.friendCount);
    const postsRemaining = postLimit === Infinity ? 'multiple' : (postLimit - currentUser.postsToday);

    if (currentUser.friendCount === 0) {
        noFriendsAlert.style.display = 'block';
        dailyLimitAlert.style.display = 'none';
        uploadContainer.style.display = 'none';
        postContent.disabled = true;
        postBtn.disabled = true;
        postLimitInfo.textContent = '';
    } else if (currentUser.postsToday >= postLimit && postLimit !== Infinity) {
        noFriendsAlert.style.display = 'none';
        dailyLimitAlert.style.display = 'block';
        uploadContainer.style.display = 'block'; // Still show container, but disable inputs
        postContent.disabled = true;
        postBtn.disabled = true;
        postLimitInfo.textContent = `You have reached your daily limit of ${postLimit} post(s).`;
    } else {
        noFriendsAlert.style.display = 'none';
        dailyLimitAlert.style.display = 'none';
        uploadContainer.style.display = 'block';
        postContent.disabled = false;
        postBtn.disabled = false;
        if (postLimit === Infinity) {
            postLimitInfo.textContent = `You can post multiple times a day.`;
        } else {
            postLimitInfo.textContent = `You can post ${postsRemaining} more time(s) today.`;
        }
    }
}

// Setup event listeners for home page
function setupEventListeners() {
    // Friends popup
    if (addFriendsBtn) { // Check if element exists (only on home.html)
        addFriendsBtn.addEventListener('click', () => {
            friendsPopup.style.display = 'block';
            renderFriendsList(); // Render available friends when popup opens
        });
    }

    // Close friends popup
    const closeFriendsBtn = document.getElementById('close-friends-btn');
    if (closeFriendsBtn) {
        closeFriendsBtn.addEventListener('click', () => {
            friendsPopup.style.display = 'none';
        });
    }

    // Add friend button click (delegated to friendsListEl)
    if (friendsListEl) {
        friendsListEl.addEventListener('click', async (event) => {
            const target = event.target.closest('.add-friend-btn'); // Use closest to handle clicks on icon inside button
            if (target) {
                const friendName = target.getAttribute('data-name');
                await addFriend(friendName);
            }
        });
    }

    // Remove friend button click (delegated to currentFriendsEl)
    if (currentFriendsEl) {
        currentFriendsEl.addEventListener('click', async (event) => {
            const target = event.target.closest('.remove-friend-btn');
            if (target) {
                const friendName = target.getAttribute('data-id'); // This is the username
                await removeFriend(friendName); // Now calls backend
            }
        });
    }

    // Media upload input change
    if (uploadBtn && mediaUploadInput) {
        uploadBtn.addEventListener('click', () => mediaUploadInput.click());
        mediaUploadInput.addEventListener('change', handleMediaUpload);
    }

    // Post button click
    if (postBtn) {
        postBtn.addEventListener('click', createPost);
    }

    // Optional: Profile popup toggle
    const profileCircle = document.getElementById('profile-circle');
    if (profileCircle) {
        profileCircle.addEventListener('click', function() {
            const profilePopup = document.getElementById('profile-popup');
            if (profilePopup) { 
                profilePopup.style.display = profilePopup.style.display === 'block' ? 'none' : 'block';
            }
        });
    }

    // Close popups if clicked outside
    window.addEventListener('click', function(event) {
        const profileCircle = document.getElementById('profile-circle');
        const profilePopup = document.getElementById('profile-popup');
        const friendsPopup = document.getElementById('friends-popup');
        const addFriendsBtn = document.getElementById('add-friends-btn');

        // Check if click is outside profile circle/popup
        if (profileCircle && profilePopup && !profileCircle.contains(event.target) && !profilePopup.contains(event.target)) {
            profilePopup.style.display = 'none';
        }
        // Check if click is outside add friends button/popup
        if (addFriendsBtn && friendsPopup && !addFriendsBtn.contains(event.target) && !friendsPopup.contains(event.target)) {
            friendsPopup.style.display = 'none';
        }
    });

    // Event delegation for post interactions (like, comment, share, delete)
    if (feedContainer) {
        feedContainer.addEventListener('click', async (event) => {
            const target = event.target;
            const postElement = target.closest('.post-card');
            if (!postElement) return;

            const postId = parseInt(postElement.dataset.postId);

            if (target.classList.contains('like-btn') || target.closest('.like-btn')) {
                await toggleLike(postId);
            } else if (target.classList.contains('comment-btn') || target.closest('.comment-btn')) {
                // Toggle comment section visibility
                const commentSection = postElement.querySelector('.post-comments');
                if (commentSection) {
                    commentSection.style.display = commentSection.style.display === 'block' ? 'none' : 'block';
                }
            } else if (target.classList.contains('share-btn') || target.closest('.share-btn')) {
                await sharePost(postId);
            } else if (target.classList.contains('submit-comment-btn')) {
                const commentInput = postElement.querySelector('.comment-input');
                if (commentInput && commentInput.value.trim()) {
                    await addComment(postId, commentInput.value.trim());
                    commentInput.value = ''; // Clear input
                }
            } else if (target.classList.contains('delete-post-btn') || target.closest('.delete-post-btn')) {
                if (confirm('Are you sure you want to delete this post?')) {
                    await deletePost(postId);
                }
            }
        });
    }
}

// --- Media Upload Handling ---
let selectedFile = null;

function handleMediaUpload(event) {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        if (mediaPreview) { // Check if mediaPreview exists
            mediaPreview.innerHTML = ''; // Clear previous preview
            mediaPreview.style.display = 'block';

            const reader = new FileReader();
            reader.onload = (e) => {
                let mediaElement;
                if (selectedFile.type.startsWith('image/')) {
                    mediaElement = document.createElement('img');
                    mediaElement.src = e.target.result;
                } else if (selectedFile.type.startsWith('video/')) {
                    mediaElement = document.createElement('video');
                    mediaElement.src = e.target.result;
                    mediaElement.controls = true;
                    mediaElement.autoplay = false;
                    mediaElement.muted = true; // Mute autoplay for better UX
                }
                if (mediaElement) {
                    mediaPreview.appendChild(mediaElement);
                }
            };
            reader.readAsDataURL(selectedFile);
        }
    } else {
        if (mediaPreview) { // Check if mediaPreview exists
            mediaPreview.innerHTML = '';
            mediaPreview.style.display = 'none';
        }
    }
}

// --- Post Creation ---
async function createPost() {
    const comment = postContent.value.trim();
    if (!comment && !selectedFile) {
        alert('Please add a comment or upload media to post.');
        return;
    }

    const formData = new FormData();
    formData.append('username', currentUser.username);
    formData.append('comment', comment);
    if (selectedFile) {
        formData.append('file', selectedFile);
    }

    console.log("Frontend: Attempting to create post...");
    console.log("Frontend: Current User:", currentUser.username);
    console.log("Frontend: Comment:", comment);
    console.log("Frontend: Selected File:", selectedFile ? selectedFile.name : "No file");


    try {
        const response = await fetch(`${API_BASE_URL}/post`, {
            method: 'POST',
            body: formData // FormData handles content-type automatically
        });

        console.log("Frontend: Response status:", response.status);
        const data = await response.json(); // This line might fail if response is not JSON
        console.log("Frontend: Response data:", data);


        if (data.success) {
            alert('Post created successfully!');
            postContent.value = ''; // Clear textarea
            if (mediaPreview) { // Check if mediaPreview exists
                mediaPreview.innerHTML = ''; // Clear preview
                mediaPreview.style.display = 'none';
            }
            if (mediaUploadInput) { // Check if mediaUploadInput exists
                mediaUploadInput.value = ''; // Clear file input
            }
            selectedFile = null; // Reset selected file

            // Re-fetch user data to get updated postsToday count from server
            await fetchUserData();
            updateFriendUI(); // Update UI based on new data
            fetchAndRenderPosts(); // Re-fetch and render posts to show new one
        } else {
            alert(`Failed to create post: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Frontend: Error creating post:', error);
        alert('Network error or server unavailable. Could not create post. Check browser console for details.');
    }
}

// --- Friend Management ---
async function renderFriendsList() {
    if (!friendsListEl) return; // Ensure element exists

    friendsListEl.innerHTML = ''; // Clear previous list

    try {
        // Fetch all registered users from the backend
        const response = await fetch(`${API_BASE_URL}/users?username=${currentUser.username}`);
        const data = await response.json();
        const allUsers = data.users || [];

        if (allUsers.length === 0) {
            friendsListEl.innerHTML = '<p>No other users registered yet.</p>';
            return;
        }

        allUsers.forEach(user => {
            // Check if user is already added to current user's friends
            const isFriend = currentUser.friends.some(f => f.name === user);
            const buttonText = isFriend ? 'Added' : '<i class="fas fa-user-plus"></i> Add';
            const buttonClass = isFriend ? 'add-friend-btn added' : 'add-friend-btn';
            const buttonDisabled = isFriend ? 'disabled' : '';

            const friendEl = document.createElement('div');
            friendEl.className = 'friend-card';
            friendEl.innerHTML = `
                <span>${user}</span>
                <button class="${buttonClass}" data-name="${user}" ${buttonDisabled}>
                    ${buttonText}
                </button>
            `;
            friendsListEl.appendChild(friendEl);
        });
    } catch (error) {
        console.error('Error fetching available users:', error);
        friendsListEl.innerHTML = '<p>Error loading users.</p>';
    }
}

async function addFriend(friendName) {
    try {
        const response = await fetch(`${API_BASE_URL}/add-friend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, friendName })
        });
        const data = await response.json();

        if (data.success) {
            alert(`You are now friends with ${friendName}!`);
            await fetchUserData(); // Re-fetch user data to update friend count
            updateFriendUI(); // Update UI
            renderFriendsList(); // Re-render "People You May Know" to update button state
        } else {
            alert(`Failed to add friend: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error adding friend:', error);
        alert('Network error or server unavailable. Could not add friend.');
    }
}

async function removeFriend(friendName) {
    // This requires a new backend endpoint for removing friends
    // For now, it's a frontend-only mock
    alert(`Removing ${friendName} is not yet implemented on the backend.`);
    // If you want to implement it, add an /api/remove-friend endpoint in server.js
    // and then call it here.
    // Example:
    /*
    try {
        const response = await fetch(`${API_BASE_URL}/remove-friend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, friendName })
        });
        const data = await response.json();
        if (data.success) {
            alert(`Removed ${friendName}.`);
            await fetchUserData();
            updateFriendUI();
            renderFriendsList();
        } else {
            alert(`Failed to remove friend: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error removing friend:', error);
        alert('Network error or server unavailable. Could not remove friend.');
    }
    */
}

// --- Post Feed Rendering ---
async function fetchAndRenderPosts() {
    if (!feedContainer) return; // Ensure element exists

    try {
        const response = await fetch(`${API_BASE_URL}/posts`);
        const data = await response.json();
        const posts = data.posts || [];

        feedContainer.innerHTML = ''; // Clear existing posts

        if (posts.length === 0) {
            feedContainer.innerHTML = '<p style="text-align: center; color: #666;">No posts yet. Be the first to share!</p>';
            return;
        }

        posts.forEach(post => {
            const postCard = document.createElement('div');
            postCard.className = 'post-card';
            postCard.dataset.postId = post.id; // Store post ID for interactions

            const isLiked = post.likes.includes(currentUser.username);
            const likeIconClass = isLiked ? 'fas' : 'far'; // Solid or regular heart

            // Check if the current user is the owner of the post
            const isOwner = post.username === currentUser.username;

            postCard.innerHTML = `
                <div class="post-header">
                    <div class="post-user-avatar"><i class="fas fa-user"></i></div>
                    <div class="post-info">
                        <span class="post-username">${post.username}</span>
                        <span class="post-time">${timeAgo(post.createdAt)}</span>
                    </div>
                    ${isOwner ? `<button class="delete-post-btn" title="Delete Post"><i class="fas fa-trash"></i></button>` : ''}
                </div>
                <div class="post-content-text">
                    <p>${post.comment}</p>
                </div>
                ${post.fileUrl ? `
                    <div class="post-media">
                        ${post.type === 'image' ? `<img src="${post.fileUrl}" alt="Post media">` : `<video src="${post.fileUrl}" controls></video>`}
                    </div>
                ` : ''}
                <div class="post-actions">
                    <button class="like-btn"><i class="${likeIconClass} fa-heart"></i> <span class="like-count">${post.likes.length}</span></button>
                    <button class="comment-btn"><i class="far fa-comment"></i> <span class="comment-count">${post.comments.length}</span></button>
                    <button class="share-btn"><i class="fas fa-share-alt"></i> Share</button>
                </div>
                <div class="post-comments" style="display:none;">
                    <div class="comment-input-group">
                        <input type="text" class="comment-input" placeholder="Add a comment...">
                        <button class="submit-comment-btn">Post</button>
                    </div>
                    <div class="comments-list">
                        ${post.comments.map(comment => `
                            <div class="comment-item">
                                <strong>${comment.user}:</strong> ${comment.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            feedContainer.appendChild(postCard);
        });
    } catch (error) {
        console.error('Error fetching posts:', error);
        feedContainer.innerHTML = '<p style="text-align: center; color: #666;">Error loading posts.</p>';
    }
}

// --- Post Interactions ---
async function toggleLike(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, postId })
        });
        const data = await response.json();

        if (data.success) {
            // Update UI immediately without re-fetching all posts
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postCard) {
                const likeBtn = postCard.querySelector('.like-btn');
                const likeIcon = likeBtn.querySelector('i');
                const likeCountSpan = likeBtn.querySelector('.like-count');
                let currentLikes = parseInt(likeCountSpan.textContent);

                if (data.liked) { // If it was liked
                    likeIcon.classList.remove('far');
                    likeIcon.classList.add('fas');
                    likeCountSpan.textContent = currentLikes + 1;
                } else { // If it was unliked
                    likeIcon.classList.remove('fas');
                    likeIcon.classList.add('far');
                    likeCountSpan.textContent = currentLikes - 1;
                }
            }
        } else {
            alert(`Failed to like/unlike post: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error toggling like:', error);
        alert('Network error or server unavailable. Could not toggle like.');
    }
}

async function addComment(postId, text) {
    try {
        const response = await fetch(`${API_BASE_URL}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, postId, text })
        });
        const data = await response.json();

        if (data.success) {
            // Update UI immediately
            const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
            if (postCard) {
                const commentsList = postCard.querySelector('.comments-list');
                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                commentItem.innerHTML = `<strong>${currentUser.username}:</strong> ${text}`;
                commentsList.appendChild(commentItem);

                const commentCountSpan = postCard.querySelector('.comment-count');
                commentCountSpan.textContent = parseInt(commentCountSpan.textContent) + 1;
            }
        } else {
            alert(`Failed to add comment: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Network error or server unavailable. Could not add comment.');
    }
}

async function sharePost(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username, postId })
        });
        const data = await response.json();

        if (data.success) {
            alert('Post shared successfully!');
        } else {
            alert(`Failed to share post: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error sharing post:', error);
        alert('Network error or server unavailable. Could not share post.');
    }
}

// --- Post Deletion Function ---
async function deletePost(postId) {
    try {
        const response = await fetch(`${API_BASE_URL}/post/${postId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: currentUser.username }) // Send username for verification
        });
        const data = await response.json();

        if (data.success) {
            alert('Post deleted successfully!');
            // Re-fetch user data to update postsToday count if needed
            await fetchUserData();
            updateFriendUI();
            fetchAndRenderPosts(); // Re-render posts to remove the deleted one
        } else {
            alert(`Failed to delete post: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Network error or server unavailable. Could not delete post.');
    }
}

// Utility function for time ago (optional, but good for UX)
function timeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const seconds = Math.round((now - past) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.4);
    const years = Math.round(days / 365);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    if (months < 12) return `${months}mo ago`;
    return `${years}y ago`;
}
