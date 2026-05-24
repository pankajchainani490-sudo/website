const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = path.join(__dirname, '../database/site.db');

try {
  // 确保数据库被初始化
  require('../database/init');
  
  const db = new Database(dbPath);
  
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin_password_123';
  
  const saltRounds = 10;
  const hashedPassword = bcrypt.hashSync(password, saltRounds);
  
  // 检查是否已经存在该用户
  const existing = db.prepare('SELECT id FROM admin WHERE username = ?').get(username);
  
  if (existing) {
    db.prepare('UPDATE admin SET password = ? WHERE username = ?').run(hashedPassword, username);
    console.log(`Admin user "${username}" password updated successfully in database.`);
  } else {
    db.prepare('INSERT INTO admin (username, password) VALUES (?, ?)').run(username, hashedPassword);
    console.log(`Admin user "${username}" created successfully in database.`);
  }
  
} catch (error) {
  console.error('Failed to setup admin user:', error);
}
