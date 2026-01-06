const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: '34.94.127.139',
  user: 'backend',
  password: 'A&urJyHhK&6=dx8k',
  database: 'work_db',
  port: 3306,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
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
    console.error('FULL MYSQL ERROR:', error);
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