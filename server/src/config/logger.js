const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: 'reconciliation-backend' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

// Optional: write errors to file in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new transports.File({ filename: 'logs/error.log', level: 'error' })
  );
  logger.add(
    new transports.File({ filename: 'logs/combined.log' })
  );
}

module.exports = logger;
