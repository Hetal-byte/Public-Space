const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();

app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // For parsing application/json

// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

// Serve uploaded media files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory data stores (for demonstration purposes - data will reset on server restart)
// In a real app, you'd use a database (MongoDB, PostgreSQL, etc.)
const users = {}; // { username: { password, friends: Set, posts: [] } }
const posts = [];
// { id, username, fileUrl, type, comment, likes: Set, comments: [{user, text}], createdAt }

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Files will be stored in the 'uploads' directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // Unique filename
  }
});
const upload = multer({ storage });

// Helper: get post limit based on friend count
function getPostLimit(friendCount) {
  if (friendCount === 0) return 0;
  if (friendCount === 1) return 1;
  if (friendCount === 2) return 2;
  if (friendCount > 10) return Infinity; // More than 10 friends, unlimited posts
  // For 3 to 10 friends, the prompt implies 2 posts per day (same as 2 friends)
  // If you want a different logic for 3-10 friends, adjust here.
  return 2; // Default for 3-10 friends, assuming 2 posts per day
}

// --- API Endpoints ---

// Register a new user
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (users[username]) return res.status(400).json({ error: 'User already exists' });
  users[username] = { password, friends: new Set(), posts: [] }; // Initialize with empty friends set and posts array
  console.log(`Server: User registered: ${username}`);
  res.json({ success: true, message: 'User registered successfully' });
});

// Login user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (!users[username] || users[username].password !== password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  console.log(`Server: User logged in: ${username}`);
  // In a real app, you'd send a JWT token here
  res.json({ success: true, message: 'Logged in successfully', username: username });
});

// Add a friend
app.post('/api/add-friend', (req, res) => {
  const { username, friendName } = req.body; // friendName is the username of the friend to add
  if (!users[username] || !users[friendName]) return res.status(400).json({ error: 'User or friend not found' });

  if (username === friendName) return res.status(400).json({ error: 'Cannot add yourself as a friend' });
  if (users[username].friends.has(friendName)) return res.status(400).json({ error: 'Already friends' });

  // Add to both users' friend lists
  users[username].friends.add(friendName);
  users[friendName].friends.add(username);
  console.log(`Server: ${username} added ${friendName} as a friend.`);
  res.json({ success: true, message: 'Friend added successfully' });
});

// Get a user's friends
app.get('/api/friends/:username', (req, res) => {
  const { username } = req.params;
  if (!users[username]) return res.status(400).json({ error: 'User not found' });
  res.json({ friends: Array.from(users[username].friends) }); // Convert Set to Array for JSON response
});

// Get all registered users (for "People You May Know" suggestions)
app.get('/api/users', (req, res) => {
    const currentUser = req.query.username; // Get current user from query param
    const allUsers = Object.keys(users).filter(u => u !== currentUser); // Exclude current user
    res.json({ users: allUsers });
});


// Create a new post with media upload
app.post('/api/post', upload.single('file'), (req, res) => {
  console.log("Server: Received POST request to /api/post");
  console.log("Server: Request body:", req.body);
  console.log("Server: Request file:", req.file);

  const { username, comment } = req.body;

  if (!users[username]) {
    console.error(`Server: User not found: ${username}`);
    return res.status(400).json({ error: 'User not found' });
  }

  // --- Post Limit Logic ---
  const friendCount = users[username].friends.size;
  const postLimit = getPostLimit(friendCount);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
  const userPostsToday = users[username].posts.filter(p => p.createdAt.startsWith(today)).length;

  if (userPostsToday >= postLimit && postLimit !== Infinity) {
    console.warn(`Server: Post limit reached for ${username}. Limit: ${postLimit}, Posts today: ${userPostsToday}`);
    return res.status(403).json({ error: `Post limit reached. You can only post ${postLimit} time(s) today.` });
  }
  // --- End Post Limit Logic ---

  if (!req.file) {
    console.error("Server: No file uploaded for post.");
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const type = req.file.mimetype.startsWith('video') ? 'video' : 'image';
  const post = {
    id: posts.length + 1, // Simple ID generation
    username,
    fileUrl: '/uploads/' + req.file.filename, // Path to access the uploaded file
    type,
    comment,
    likes: new Set(), // Store likes as a Set of usernames
    comments: [],
    createdAt: new Date().toISOString() // ISO string for easy date comparison
  };

  posts.unshift(post); // Add new post to the beginning of the global posts array
  users[username].posts.push(post); // Add post to the user's specific posts array
  console.log(`Server: New post by ${username}: ${post.comment}`);
  res.json({ success: true, post });
});

// Get all posts (or a feed)
app.get('/api/posts', (req, res) => {
  // Convert Sets to Arrays for JSON serialization
  res.json({ posts: posts.map(p => ({
    ...p,
    likes: Array.from(p.likes),
    comments: p.comments
  })) });
});

// Like a post
app.post('/api/like', (req, res) => {
  const { username, postId } = req.body;
  const post = posts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  if (post.likes.has(username)) {
    post.likes.delete(username); // Unlike if already liked
    console.log(`Server: ${username} unliked post ${postId}`);
    res.json({ success: true, liked: false, message: 'Post unliked' });
  } else {
    post.likes.add(username); // Like
    console.log(`Server: ${username} liked post ${postId}`);
    res.json({ success: true, liked: true, message: 'Post liked' });
  }
});

// Comment on a post
app.post('/api/comment', (req, res) => {
  const { username, postId, text } = req.body;
  const post = posts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  post.comments.push({ user: username, text, createdAt: new Date().toISOString() });
  console.log(`Server: ${username} commented on post ${postId}: "${text}"`);
  res.json({ success: true, message: 'Comment added' });
});

// Share a post (placeholder for now)
app.post('/api/share', (req, res) => {
  const { username, postId } = req.body;
  console.log(`Server: ${username} shared post ${postId}`);
  res.json({ success: true, message: 'Post shared' });
});

// DELETE Post
app.delete('/api/post/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  const { username } = req.body; // Expect username in body to verify ownership

  const postIndex = posts.findIndex(p => p.id === postId);

  if (postIndex === -1) {
    console.error(`Server: Post ${postId} not found for deletion.`);
    return res.status(404).json({ error: 'Post not found' });
  }

  const postToDelete = posts[postIndex];

  // Verify ownership: Only the user who posted can delete it
  if (postToDelete.username !== username) {
    console.warn(`Server: Unauthorized delete attempt on post ${postId} by ${username}. Owner: ${postToDelete.username}`);
    return res.status(403).json({ error: 'Unauthorized: You can only delete your own posts.' });
  }

  // Remove from global posts array
  posts.splice(postIndex, 1);

  // Also remove from the user's specific posts array
  if (users[username]) {
    users[username].posts = users[username].posts.filter(p => p.id !== postId);
  }

  console.log(`Server: Post ${postId} deleted by ${username}.`);
  res.json({ success: true, message: 'Post deleted successfully' });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Serving static files from: ${__dirname}`);
  console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
});
