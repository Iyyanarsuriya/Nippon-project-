import dotenv from 'dotenv';
import http from 'http';
import app from './app.js';
import { initWebSocket } from './src/config/websocket.js';
import { testConnection } from './src/config/db.js';

import { ensureHodApprovalsTable } from './src/models/hodApprovalModel.js';
import { ensureTablesExist } from './src/models/effectivenessModel.js';

dotenv.config();

const PORT = process.env.PORT || 5002;

const startServer = async () => {
  try {
    await testConnection();

    console.log('🔄 Running database schema checks...');
    await ensureTablesExist();
    await ensureHodApprovalsTable();
    console.log('✅ Database schema checks completed successfully.');

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