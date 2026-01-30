const UploadJob = require('../models/UploadJob');
const { uploadQueue } = require('../queues/upload.queue');

exports.createUploadJob = async ({ userId, fileName, fileHash, filePath }) => {
  const job = await UploadJob.create({
    userId,
    fileName,
    fileHash
  });

  await uploadQueue.add('process-upload', {
    jobId: job._id,
    filePath
  });

  return job;
};
