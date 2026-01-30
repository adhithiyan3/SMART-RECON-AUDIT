// models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  recordId: mongoose.Schema.Types.ObjectId,
  uploadJobId: mongoose.Schema.Types.ObjectId,
  actionType: { type: String, required: true }, // CREATE, SYSTEM_MATCH, SYSTEM_PARTIAL, MANUAL_UPDATE, STATUS_CHANGE, SYSTEM_DUPLICATE, REPROCESS
  fieldName: String,
  oldValue: Object,
  newValue: Object,
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // userId
  userEmail: String,
  userRole: String,
  source: { type: String, enum: ['UI', 'SYSTEM', 'API'], default: 'SYSTEM' },
  description: String,
  timestamp: { type: Date, default: Date.now }
});

// Immutability: Prevent updates and deletions
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are immutable and cannot be modified.'));
  }
  next();
});

const blockMutation = function (next) {
  next(new Error('Audit logs are immutable and cannot be modified or deleted.'));
};

auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('updateMany', blockMutation);
auditLogSchema.pre('deleteOne', { document: true, query: true }, blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);
auditLogSchema.pre('findOneAndRemove', blockMutation);
auditLogSchema.pre('remove', blockMutation);

auditLogSchema.index({ recordId: 1, timestamp: 1 });
auditLogSchema.index({ uploadJobId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
