const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  recordId: mongoose.Schema.Types.ObjectId,
  systemRecordId: mongoose.Schema.Types.ObjectId,
  uploadJobId: mongoose.Schema.Types.ObjectId,
  status: {
    type: String,
    enum: ['MATCHED', 'PARTIALLY_MATCHED', 'NOT_MATCHED', 'DUPLICATE']
  },
  matchScore: Number
}, { timestamps: true });

schema.index({ uploadJobId: 1, status: 1 });
schema.index({ createdAt: 1 });

module.exports = mongoose.model('ReconciliationResult', schema);
