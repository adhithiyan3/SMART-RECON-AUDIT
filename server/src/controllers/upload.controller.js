const UploadJob = require('../models/UploadJob');
const Record = require('../models/Record');
const ReconciliationResult = require('../models/ReconciliationResult');
const { uploadQueue } = require('../queues/upload.queue');
const getFileHash = require('../utils/fileHash');
const XLSX = require('xlsx');
const fs = require('fs');

exports.checkDuplicate = async (req, res) => {
  try {
    const { fileHash } = req.body;
    const existing = await UploadJob.findOne({ fileHash, userId: req.user.id });
    res.json({ exists: !!existing, jobId: existing?._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadFile = async (req, res) => {
  try {
    const hash = await getFileHash(req.file.path);

    const existing = await UploadJob.findOne({ fileHash: hash });
    if (existing) {
      // Re-uploading same file - return headers from stored file
      const workbook = XLSX.readFile(existing.filePath, { sheetRows: 21 });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] || [];

      return res.json({
        jobId: existing._id,
        reused: true,
        status: existing.status,
        headers: headers
      });
    }

    // Get preview
    const workbook = XLSX.readFile(req.file.path, { sheetRows: 21 });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const preview = XLSX.utils.sheet_to_json(firstSheet);
    const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] || [];

    const job = await UploadJob.create({
      userId: req.user.id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileHash: hash,
      fileSize: req.file.size,
      status: 'VALIDATING'
    });

    // Simulate validation/background prep or just move to pending mapping
    // In a real app, this might be where we do more complex checks
    job.status = 'PENDING_MAPPING';
    await job.save();

    res.status(202).json({
      jobId: job._id,
      preview,
      headers
    });
  } catch (err) {
    res.status(500).json({ error: 'File upload failed: ' + err.message });
  }
};

exports.submitMapping = async (req, res) => {
  try {
    const { mapping } = req.body;
    const { id } = req.params;

    const job = await UploadJob.findById(id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    // Reset stats for reprocessing
    job.processed = 0;
    job.failed = 0;
    job.totalMatched = 0;
    job.totalPartial = 0;
    job.totalUnmatched = 0;
    job.totalDuplicate = 0;
    // Check if mapping is unchanged and job is already completed
    if (job.status === 'COMPLETED' && JSON.stringify(job.columnMapping) === JSON.stringify(mapping)) {
      return res.json({ message: 'Mapping unchanged, reusing existing results', jobId: job._id, reused: true });
    }

    // Reset stats for reprocessing
    job.processed = 0;

    // Clear existing results for this job to prevent duplicates
    await ReconciliationResult.deleteMany({ uploadJobId: job._id });

    await uploadQueue.add('process-upload', {
      jobId: job._id,
      filePath: job.filePath,
      fileName: job.fileName,
      mapping
    });

    res.json({ message: 'Mapping submitted, processing started', jobId: job._id });
  } catch (err) {
    res.status(500).json({ error: 'Mapping submission failed: ' + err.message });
  }
};

exports.getJobStatus = async (req, res) => {
  const job = await UploadJob.findById(req.params.id);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const latestRecord = await Record.findOne({ uploadJobId: job._id }).sort({ _id: -1 }).lean();

  // Extract headers and preview for UI rehydration
  let headers = [];
  let preview = [];
  try {
    const workbook = XLSX.readFile(job.filePath, { sheetRows: 21 });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    preview = XLSX.utils.sheet_to_json(firstSheet);
    headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] || [];
  } catch (err) {
    console.error('Failed to read file for job status rehydration', err);
  }

  res.json({
    jobId: job._id,
    status: job.status,
    fileName: job.fileName,
    processed: job.processed,
    failed: job.failed,
    totalMatched: job.totalMatched,
    totalPartial: job.totalPartial,
    totalUnmatched: job.totalUnmatched,
    totalDuplicate: job.totalDuplicate,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    columnMapping: job.columnMapping,
    headers,
    preview,
    latestRecord: latestRecord ? {
      transactionId: latestRecord.transactionId,
      amount: latestRecord.amount,
      refNumber: latestRecord.refNumber
    } : null
  });
};

exports.getActiveJob = async (req, res) => {
  try {
    const job = await UploadJob.findOne({
      userId: req.user.id,
      status: { $in: ['PENDING_MAPPING', 'VALIDATING', 'PROCESSING'] }
    }).sort({ createdAt: -1 });

    if (!job) return res.json(null);

    const latestRecord = await Record.findOne({ uploadJobId: job._id }).sort({ _id: -1 }).lean();

    res.json({
      jobId: job._id,
      status: job.status,
      fileName: job.fileName,
      processed: job.processed,
      failed: job.failed,
      totalMatched: job.totalMatched,
      totalPartial: job.totalPartial,
      totalUnmatched: job.totalUnmatched,
      totalDuplicate: job.totalDuplicate,
      latestRecord: latestRecord ? {
        transactionId: latestRecord.transactionId,
        amount: latestRecord.amount,
        refNumber: latestRecord.refNumber
      } : null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUploadHistory = async (req, res) => {
  try {
    const history = await UploadJob.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10); // Limit to last 10 for performance

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
