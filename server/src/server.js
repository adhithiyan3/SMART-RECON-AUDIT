require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const logger = require('./config/logger');

// Start background workers
require('./jobs');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();
    await require('./controllers/config.controller').initializeDefaults();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.warn('SIGTERM received. Shutting down gracefully...');
      server.close(() => process.exit(0));
    });

  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
})();
