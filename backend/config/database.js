const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER, // Change this to your MySQL username
  password: process.env.DB_PASSWORD, // Change this to your MySQL password
  database: process.env.DB_NAME, // Change this to your MySQL database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL database successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Error connecting to MySQL database:', error.message);
    return false;
  }
};

// Execute query helper function
const executeQuery = async (query, params = []) => {
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Get a single record
const findOne = async (query, params = []) => {
  try {
    const results = await executeQuery(query, params);
    return results[0] || null;
  } catch (error) {
    throw error;
  }
};

// Get multiple records
const findMany = async (query, params = []) => {
  try {
    const results = await executeQuery(query, params);
    return results;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  pool,
  testConnection,
  executeQuery,
  findOne,
  findMany
}; 