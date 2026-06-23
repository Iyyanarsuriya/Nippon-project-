import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const isProductionDb = !!process.env.MYSQLHOST;

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password:
    process.env.MYSQLPASSWORD !== undefined
      ? process.env.MYSQLPASSWORD
      : process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'cms_db',
  port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),

  waitForConnections: true,
  connectionLimit: isProductionDb ? 10 : 5,
  queueLimit: 0,

  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  ssl: isProductionDb ? { rejectUnauthorized: false } : undefined
});

export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ Connected to MySQL database successfully.');
  } catch (error) {
    console.error('❌ Error connecting to MySQL database:', error.message);
    throw error;
  }
};

export default pool;