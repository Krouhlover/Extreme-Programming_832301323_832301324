// db.config.js
export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'contact_app',
  password: process.env.DB_PASSWORD || 'contact_password',
  database: process.env.DB_NAME || 'contact_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};