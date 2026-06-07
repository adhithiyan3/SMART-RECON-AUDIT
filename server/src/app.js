const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const logger = require('./config/logger');
const errorHandler = require('./middlewares/error.middleware');

const app = express();
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'https://smart-recon-audit.vercel.app'
    ];
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow exact matches or any Vercel preview URL for this project
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') && origin.includes('adhithiyans-projects')
    ) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// HTTP request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

app.use('/api', routes);

// Central error handler
app.use(errorHandler);

module.exports = app;
