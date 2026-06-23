import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let activePool = null;

const isRemoteDb = () => {
  const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (connectionUri) {
    return !connectionUri.includes('localhost') && !connectionUri.includes('127.0.0.1');
  }
  const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
  return host !== 'localhost' && host !== '127.0.0.1';
};

const getDatabaseConfig = (useSsl) => {
  const connectionUri = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (connectionUri) {
    return {
      uri: connectionUri,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      waitForConnections: true,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    };
  }

  return {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password:
      process.env.MYSQLPASSWORD !== undefined
        ? process.env.MYSQLPASSWORD
        : process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'cms_db',
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectTimeout: 20000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  };
};

export const testConnection = async () => {
  const isRemote = isRemoteDb();

  // Attempt 1: Connect with SSL if remote
  if (isRemote) {
    const config = getDatabaseConfig(true);
    const hostInfo = config.uri ? 'Connection URL' : config.host;
    console.log(`ℹ️ Remote database detected (${hostInfo}). Attempting to connect with SSL...`);
    try {
      activePool = mysql.createPool({
        ...config,
        connectionLimit: 10,
      });
      
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
  const config = getDatabaseConfig(false);
  const hostInfo = config.uri ? 'Connection URL' : config.host;
  console.log(`ℹ️ Attempting to connect to ${hostInfo} without SSL...`);
  try {
    activePool = mysql.createPool({
      ...config,
      connectionLimit: isRemote ? 10 : 5,
    });
    
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