// models/UploadJob.js
const mongoose = require('mongoose');

const uploadJobSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  fileName: String,
  filePath: String,
  fileHash: { type: String, unique: true },
  fileSize: Number,
  columnMapping: {
    transactionId: String,
    amount: String,
    refNumber: String,
    date: String
  },
  status: {
    type: String,
    enum: ['PENDING_MAPPING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'FAILED'],
    default: 'PENDING_MAPPING'
  },
  processed: { type: Number, default: 0 },
  failed: { type: Number, default: 0 },
  totalMatched: { type: Number, default: 0 },
  totalPartial: { type: Number, default: 0 },
  totalUnmatched: { type: Number, default: 0 },
  totalDuplicate: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('UploadJob', uploadJobSchema);
