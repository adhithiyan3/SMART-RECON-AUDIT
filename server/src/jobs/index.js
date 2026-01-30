const { Worker } = require('bullmq');
const redis = require('../config/redis');
const processUpload = require('./upload.processor');

new Worker('uploadQueue', processUpload, {
  connection: redis
});

console.log('Upload worker started');
