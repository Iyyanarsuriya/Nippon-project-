import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import { initWebSocket } from './src/config/websocket.js';
import { testConnection } from './src/config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5002;

const startServer = async () => {
  try {
    await testConnection();

    const server = http.createServer(app);
    initWebSocket(server);

    server.listen(PORT, () => {
      console.log(`🚀 Change Management Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();