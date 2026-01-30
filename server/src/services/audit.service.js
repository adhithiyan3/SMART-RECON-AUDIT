const AuditLog = require('../models/AuditLog');

/**
 * Logs an audit event.
 * Requirement 4: Audit logging must happen before any primary data modification.
 * In a production system, this might be wrapped in a DB transaction.
 */
exports.log = async (auditData) => {
  return await AuditLog.create({
    recordId: auditData.recordId,
    uploadJobId: auditData.uploadJobId,
    actionType: auditData.actionType,
    fieldName: auditData.fieldName,
    oldValue: auditData.oldValue,
    newValue: auditData.newValue,
    performedBy: auditData.performedBy,
    userEmail: auditData.userEmail,
    userRole: auditData.userRole,
    source: auditData.source || 'SYSTEM',
    description: auditData.description,
    timestamp: new Date()
  });
};

/**
 * Requirement 4 & 5: Audit logging must occur before any modification.
 * Handled here by awaiting log before the update promise.
 */
exports.auditAndUpdate = async (auditData, updateFn) => {
  // Step 1: Persist immutable audit log
  await exports.log(auditData);

  // Step 2: Apply actual data update (only if audit log succeeds)
  return await updateFn();
};
