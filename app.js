const express = require('express');
const session = require('express-session');
const path = require('path');
const Database = require('better-sqlite3');
const { marked } = require('marked');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Initialize Database
require('./database/init');
const dbPath = path.join(__dirname, 'database/site.db');
const db = new Database(dbPath);

const app = express();
const PORT = process.env.PORT || 3000;

// EJS Template Configuration
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware Configuration
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_key_antigravity',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 Hours
  }
}));

// Context Middleware (Provide user login status and current path to all templates)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  next();
});

// ==================== 1. Public Frontend Routes ====================

// Home Page
app.get('/', (req, res) => {
  try {
    const latestPosts = db.prepare('SELECT * FROM posts WHERE is_published = 1 ORDER BY created_at DESC LIMIT 3').all();
    const featuredProjects = db.prepare('SELECT * FROM projects WHERE is_visible = 1 ORDER BY sort_order ASC, created_at DESC LIMIT 3').all();
    
    res.render('public/home', {
      title: 'Home',
      latestPosts,
      featuredProjects
    });
  } catch (error) {
    console.error('Error loading home page:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Blog List Page (With Pagination & Tag Filtering)
app.get('/blog', (req, res) => {
  try {
    const limit = 6;
    const currentPage = parseInt(req.query.page, 10) || 1;
    const offset = (currentPage - 1) * limit;
    const selectedTag = req.query.tag ? req.query.tag.trim() : '';

    // 1. Dynamic Tags Extraction (Extract & de-duplicate tags from all published blogs)
    const allTagsRows = db.prepare('SELECT tags FROM posts WHERE is_published = 1').all();
    const tagSet = new Set();
    allTagsRows.forEach(row => {
      if (row.tags) {
        row.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    const uniqueTags = Array.from(tagSet);

    // 2. Fetch Posts & Count based on Tag Filter
    let posts;
    let totalCount;

    if (selectedTag) {
      const tagLike = `%${selectedTag}%`;
      totalCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE is_published = 1 AND tags LIKE ?').get(tagLike).count;
      posts = db.prepare('SELECT * FROM posts WHERE is_published = 1 AND tags LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?').all(tagLike, limit, offset);
    } else {
      totalCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE is_published = 1').get().count;
      posts = db.prepare('SELECT * FROM posts WHERE is_published = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
    }

    const totalPages = Math.ceil(totalCount / limit) || 1;

    res.render('public/blog-list', {
      title: 'Blog',
      posts,
      uniqueTags,
      selectedTag,
      currentPage,
      totalPages
    });
  } catch (error) {
    console.error('Error loading blog list:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Blog Detail Page
app.get('/blog/:slug', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE slug = ? AND is_published = 1').get(req.params.slug);
    if (!post) {
      return res.status(404).render('public/404', { title: '404 Not Found' });
    }
    
    post.htmlContent = marked.parse(post.content || '');
    
    res.render('public/blog-detail', {
      title: post.title,
      post
    });
  } catch (error) {
    console.error('Error loading blog detail:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Projects Showcase Page
app.get('/projects', (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects WHERE is_visible = 1 ORDER BY sort_order ASC, created_at DESC').all();
    res.render('public/projects', {
      title: 'Projects',
      projects
    });
  } catch (error) {
    console.error('Error loading projects list:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ==================== 2. Admin Management Routes ====================

// Route Protection Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/admin/login');
  }
  next();
};

// Login Page
app.get('/admin/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { title: 'Admin Login' });
});

// Handle Login Submission
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  try {
    const adminUser = db.prepare('SELECT * FROM admin WHERE username = ?').get(username);
    if (adminUser && bcrypt.compareSync(password, adminUser.password)) {
      req.session.user = { id: adminUser.id, username: adminUser.username };
      return res.redirect('/admin');
    }
    res.render('admin/login', { title: 'Admin Login', error: 'Invalid username or password' });
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { title: 'Admin Login', error: 'Internal system error, please try again later' });
  }
});

// Handle Logout Logic
app.get('/admin/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
});

// Dashboard (Protected)
app.get('/admin', requireAuth, (req, res) => {
  try {
    const postsCount = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;
    const draftsCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE is_published = 0').get().count;
    const projectsCount = db.prepare('SELECT COUNT(*) as count FROM projects').get().count;

    res.render('admin/dashboard', { 
      title: 'Dashboard', 
      stats: { postsCount, draftsCount, projectsCount } 
    });
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ==================== 3. Blog Management Back-office CRUD ====================

// Blog List Dashboard
app.get('/admin/posts', requireAuth, (req, res) => {
  try {
    const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
    res.render('admin/blog-list', { title: 'Blog Management', posts });
  } catch (error) {
    console.error('Error fetching admin posts:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Create Post Page
app.get('/admin/posts/new', requireAuth, (req, res) => {
  res.render('admin/blog-editor', {
    title: 'Create New Post',
    isEdit: false,
    post: { title: '', slug: '', summary: '', tags: '', content: '', is_published: 0 }
  });
});

// Handle Create Post Submission
app.post('/admin/posts/new', requireAuth, (req, res) => {
  const { title, slug, summary, tags, content, is_published } = req.body;
  const publishedVal = is_published === '1' ? 1 : 0;
  
  try {
    const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
    if (existing) {
      return res.render('admin/blog-editor', {
        title: 'Create New Post',
        isEdit: false,
        post: { title, slug, summary, tags, content, is_published: publishedVal },
        error: 'This URL Slug is already taken, please choose another one'
      });
    }

    db.prepare(`
      INSERT INTO posts (title, slug, summary, content, tags, is_published)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(title, slug, summary, content, tags || '', publishedVal);

    res.redirect('/admin/posts');
  } catch (error) {
    console.error('Error creating post:', error);
    res.render('admin/blog-editor', {
      title: 'Create New Post',
      isEdit: false,
      post: { title, slug, summary, tags, content, is_published: publishedVal },
      error: 'Failed to save post, please check your input'
    });
  }
});

// Edit Post Page
app.get('/admin/posts/edit/:id', requireAuth, (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
    if (!post) {
      return res.status(404).send('Article not found');
    }
    res.render('admin/blog-editor', {
      title: 'Edit Post',
      isEdit: true,
      post
    });
  } catch (error) {
    console.error('Error fetching post for edit:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle Edit Post Submission
app.post('/admin/posts/edit/:id', requireAuth, (req, res) => {
  const { title, slug, summary, tags, content, is_published } = req.body;
  const publishedVal = is_published === '1' ? 1 : 0;
  const postId = req.params.id;

  try {
    const existing = db.prepare('SELECT id FROM posts WHERE slug = ? AND id != ?').get(slug, postId);
    if (existing) {
      return res.render('admin/blog-editor', {
        title: 'Edit Post',
        isEdit: true,
        post: { id: postId, title, slug, summary, tags, content, is_published: publishedVal },
        error: 'This URL Slug is already taken, please choose another one'
      });
    }

    db.prepare(`
      UPDATE posts 
      SET title = ?, slug = ?, summary = ?, content = ?, tags = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, slug, summary, content, tags || '', publishedVal, postId);

    res.redirect('/admin/posts');
  } catch (error) {
    console.error('Error updating post:', error);
    res.render('admin/blog-editor', {
      title: 'Edit Post',
      isEdit: true,
      post: { id: postId, title, slug, summary, tags, content, is_published: publishedVal },
      error: 'Failed to save changes, please try again'
    });
  }
});

// Toggle Post Publish Status
app.get('/admin/posts/toggle/:id', requireAuth, (req, res) => {
  try {
    const post = db.prepare('SELECT is_published FROM posts WHERE id = ?').get(req.params.id);
    if (post) {
      const newStatus = post.is_published === 1 ? 0 : 1;
      db.prepare('UPDATE posts SET is_published = ? WHERE id = ?').run(newStatus, req.params.id);
    }
    res.redirect('/admin/posts');
  } catch (error) {
    console.error('Error toggling post status:', error);
    res.status(500).send('Failed to toggle status');
  }
});

// Delete Post
app.get('/admin/posts/delete/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.redirect('/admin/posts');
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).send('Failed to delete article');
  }
});

// ==================== 4. Project Showcase Back-office CRUD ====================

// Project List Dashboard
app.get('/admin/projects', requireAuth, (req, res) => {
  try {
    const projects = db.prepare('SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC').all();
    res.render('admin/project-list', { title: 'Project Showcase Management', projects });
  } catch (error) {
    console.error('Error fetching admin projects:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Create Project Page
app.get('/admin/projects/new', requireAuth, (req, res) => {
  res.render('admin/project-editor', {
    title: 'Add New Project',
    isEdit: false,
    project: { name: '', url: '', icon: '🚀', category: '', sort_order: 0, is_visible: 1, description: '' }
  });
});

// Handle Create Project Submission
app.post('/admin/projects/new', requireAuth, (req, res) => {
  const { name, url, icon, category, sort_order, is_visible, description } = req.body;
  const visibleVal = is_visible === '1' ? 1 : 0;
  const sortVal = parseInt(sort_order, 10) || 0;

  try {
    db.prepare(`
      INSERT INTO projects (name, url, icon, category, sort_order, is_visible, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, url, icon || '🚀', category || '', sortVal, visibleVal, description || '');

    res.redirect('/admin/projects');
  } catch (error) {
    console.error('Error creating project:', error);
    res.render('admin/project-editor', {
      title: 'Add New Project',
      isEdit: false,
      project: { name, url, icon, category, sort_order: sortVal, is_visible: visibleVal, description },
      error: 'Failed to save project, please try again'
    });
  }
});

// Edit Project Page
app.get('/admin/projects/edit/:id', requireAuth, (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) {
      return res.status(404).send('Project not found');
    }
    res.render('admin/project-editor', {
      title: 'Edit Project',
      isEdit: true,
      project
    });
  } catch (error) {
    console.error('Error fetching project for edit:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle Edit Project Submission
app.post('/admin/projects/edit/:id', requireAuth, (req, res) => {
  const { name, url, icon, category, sort_order, is_visible, description } = req.body;
  const visibleVal = is_visible === '1' ? 1 : 0;
  const sortVal = parseInt(sort_order, 10) || 0;
  const projectId = req.params.id;

  try {
    db.prepare(`
      UPDATE projects 
      SET name = ?, url = ?, icon = ?, category = ?, sort_order = ?, is_visible = ?, description = ?
      WHERE id = ?
    `).run(name, url, icon || '🚀', category || '', sortVal, visibleVal, description || '', projectId);

    res.redirect('/admin/projects');
  } catch (error) {
    console.error('Error updating project:', error);
    res.render('admin/project-editor', {
      title: 'Edit Project',
      isEdit: true,
      project: { id: projectId, name, url, icon, category, sort_order: sortVal, is_visible: visibleVal, description },
      error: 'Failed to save changes, please try again'
    });
  }
});

// Toggle Project Visibility Status
app.get('/admin/projects/toggle/:id', requireAuth, (req, res) => {
  try {
    const project = db.prepare('SELECT is_visible FROM projects WHERE id = ?').get(req.params.id);
    if (project) {
      const newStatus = project.is_visible === 1 ? 0 : 1;
      db.prepare('UPDATE projects SET is_visible = ? WHERE id = ?').run(newStatus, req.params.id);
    }
    res.redirect('/admin/projects');
  } catch (error) {
    console.error('Error toggling project status:', error);
    res.status(500).send('Failed to toggle status');
  }
});

// Delete Project
app.get('/admin/projects/delete/:id', requireAuth, (req, res) => {
  try {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.redirect('/admin/projects');
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).send('Failed to delete project');
  }
});

// 404 Route
app.use((req, res) => {
  res.status(404).render('public/404', { title: '404 Not Found' });
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
