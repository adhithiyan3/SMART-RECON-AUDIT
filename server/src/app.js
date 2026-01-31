const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const logger = require('./config/logger');
const errorHandler = require('./middlewares/error.middleware');

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'https://smart-recon-audit.vercel.app'],
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
