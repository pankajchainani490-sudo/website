const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/site.db');

try {
  // Ensure database is initialized
  require('../database/init');
  
  const db = new Database(dbPath);
  
  // Clear old data for translation seeding
  db.prepare('DELETE FROM posts').run();
  db.prepare('DELETE FROM projects').run();
  console.log('Cleared existing posts and projects for clean English seeding.');
  
  console.log('Seeding English blog posts...');
  const insertPost = db.prepare(`
    INSERT INTO posts (title, slug, summary, content, cover_image, tags, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  insertPost.run(
    'My First Tech Blog: Building an Ultra-lightweight Website with Node.js & SQLite',
    'my-first-tech-blog-nodejs-sqlite',
    'In this post, I will share how I built and deployed a clean, responsive personal website in just a few hours using Node.js, Express, and a zero-configuration SQLite database.',
    `# Building an Ultra-lightweight Website with Node.js & SQLite

A personal website is not just a window to showcase yourself, but also a playground for technical practice. In a world full of heavy frameworks, sometimes **returning to simplicity** is the ultimate sophistication.

Today, let's discuss how to build a clean and beautiful blog with an exceptionally lightweight configuration.

## Why Node.js + Express + SQLite + EJS?

- **Express**: The most classic web framework in the Node.js ecosystem. Free of unnecessary constraints, giving you 100% control.
- **SQLite**: A true "zero-configuration" database! All data is stored in a single local file, requiring no database server installation, making it perfect for personal websites.
- **EJS**: Extremely fast server-side rendering, and naturally SEO-friendly.

## Quick Setup of an Express App

First, we install the basic dependencies:
\`\`\`bash
npm install express better-sqlite3 ejs dotenv
\`\`\`

Here is a look at the minimalist entry file code:
\`\`\`javascript
const express = require('express');
const Database = require('better-sqlite3');
const app = express();

const db = new Database('database/site.db');

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
\`\`\`

## Conclusion

Such a minimalist tech stack has an extremely low memory footprint (usually under 50MB) and runs exceptionally smooth even on low-end servers. In the next post, we will share how to use **Nginx + PM2** to stably deploy it on your cloud server.`,
    '',
    'Node.js, Express, SQLite',
    1
  );

  insertPost.run(
    'Crafting a Minimalist Linear-Style Web Design',
    'how-to-design-linear-style-web',
    'An exploration of the design philosophy behind Linear and Vercel. From dark mode color schemes, subtle background grids, soft gradients to smooth hover micro-animations.',
    `# Crafting a Minimalist Linear-Style Web Design

You must have seen many stunning modern web designs, such as [Linear](https://linear.app) or [Vercel](https://vercel.com). Their interfaces always convey a sense of **premium, high-tech, and comfortable** elegance.

Such designs typically rely on several key elements:

## 1. Harmonious Dark Themes (Sleek Dark Mode)
A premium black is never pure black (\`#000000\`), but a deep gray with warm or cool undertones. For instance, the HSL variables we use:
\`\`\`css
--bg-base: hsl(220, 15%, 8%);
--bg-surface: hsl(220, 13%, 12%);
\`\`\`
This color scheme significantly reduces eye strain while making bright accent colors pop out.

## 2. Tech-Infused Grid Backgrounds
Using CSS \`radial-gradient\` combined with \`mask-image\` creates a grid background with a fascinating depth:
\`\`\`css
.bg-grid {
  position: fixed;
  background-image: radial-gradient(var(--border-color) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle at 50% 30%, black, transparent 80%);
}
\`\`\`

## 3. Smooth Gradients & Glowing Micro-interactions
Adding physical feedback (such as \`translateY(-4px)\`) and triggering gradient border glows when a card is hovered or a button is clicked makes the webpage feel alive.

## Summary
Minimalism is not about being plain; it is about absolute clarity. By polishing typography, spacing, and micro-animations, vanilla CSS can deliver breath-taking visual experiences.`,
    '',
    'CSS, Web Design, Frontend',
    1
  );
  console.log('English blog posts seeded successfully!');

  console.log('Seeding English projects...');
  const insertProject = db.prepare(`
    INSERT INTO projects (name, description, url, icon, category, sort_order, is_visible)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertProject.run(
    'My GitHub Profile',
    'Explore my open-source projects, repositories, and daily contributions on my GitHub profile.',
    'https://github.com',
    '🐙',
    'GitHub',
    1,
    1
  );

  insertProject.run(
    'My Weather Dashboard',
    'A lightweight React weather forecast app deployed on port 8080. Supports city search and 7-day forecast.',
    'http://localhost:8080',
    '☀️',
    'Web App',
    2,
    1
  );

  insertProject.run(
    'API Performance Monitor',
    'A lightweight server status and API performance monitoring dashboard deployed on port 9000.',
    'http://localhost:9000',
    '📊',
    'Server Tool',
    3,
    1
  );
  console.log('English projects seeded successfully!');

  console.log('Database English seeding completed successfully.');
} catch (error) {
  console.error('Error seeding English data into database:', error);
}
