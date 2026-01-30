// models/Record.js
const mongoose = require('mongoose');

const recordSchema = new mongoose.Schema({
  uploadJobId: mongoose.Schema.Types.ObjectId,
  transactionId: String,
  refNumber: String,
  amount: Number,
  date: Date
});

recordSchema.index({ transactionId: 1 });
recordSchema.index({ refNumber: 1 });
recordSchema.index({ uploadJobId: 1 });

module.exports = mongoose.model('Record', recordSchema);
