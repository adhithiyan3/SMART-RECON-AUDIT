const { Queue } = require('bullmq');
const redis = require('../config/redis');

const uploadQueue = new Queue('uploadQueue', {
  connection: redis
});

module.exports = { uploadQueue };
