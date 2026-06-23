import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let activePool = null;

const getBaseConfig = () => {
  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password:
      process.env.MYSQLPASSWORD !== undefined
        ? process.env.MYSQLPASSWORD
        : process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'cms_db',
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
    waitForConnections: true,
    connectTimeout: 20000, // 20 seconds timeout for fast fallbacks
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };
};

export const testConnection = async () => {
  const baseConfig = getBaseConfig();
  const host = baseConfig.host;
  const isRemote = host !== 'localhost' && host !== '127.0.0.1';

  // Attempt 1: Connect with SSL if remote
  if (isRemote) {
    console.log(`ℹ️ Remote database detected (${host}). Attempting to connect with SSL...`);
    try {
      const sslConfig = {
        ...baseConfig,
        ssl: { rejectUnauthorized: false },
        connectionLimit: 10,
      };
      activePool = mysql.createPool(sslConfig);
      
      // Test the pool connection
      const connection = await activePool.getConnection();
      await connection.ping();
      connection.release();
      
      console.log('✅ Connected to MySQL database successfully with SSL enabled.');
      return;
    } catch (sslError) {
      console.warn(`⚠️ Connection with SSL failed: ${sslError.message}. Retrying without SSL...`);
      if (activePool) {
        await activePool.end().catch(() => {});
        activePool = null;
      }
    }
  }

  // Attempt 2: Connect without SSL (fallback or local)
  console.log(`ℹ️ Attempting to connect without SSL...`);
  try {
    const noSslConfig = {
      ...baseConfig,
      connectionLimit: isRemote ? 10 : 5,
    };
    activePool = mysql.createPool(noSslConfig);
    
    // Test the pool connection
    const connection = await activePool.getConnection();
    await connection.ping();
    connection.release();
    
    console.log('✅ Connected to MySQL database successfully without SSL.');
  } catch (error) {
    console.error('❌ Database connection failed under all configurations:', error.message);
    if (activePool) {
      await activePool.end().catch(() => {});
      activePool = null;
    }
    throw error;
  }
};

// Proxy object that matches the mysql2 pool interface
const poolProxy = {
  query: async (sql, params) => {
    if (!activePool) {
      throw new Error('Database pool has not been initialized. Call testConnection() first.');
    }
    return activePool.query(sql, params);
  },
  getConnection: async () => {
    if (!activePool) {
      throw new Error('Database pool has not been initialized. Call testConnection() first.');
    }
    return activePool.getConnection();
  },
  execute: async (sql, params) => {
    if (!activePool) {
      throw new Error('Database pool has not been initialized. Call testConnection() first.');
    }
    return activePool.execute(sql, params);
  },
  end: async () => {
    if (activePool) {
      return activePool.end();
    }
  }
};

export default poolProxy;