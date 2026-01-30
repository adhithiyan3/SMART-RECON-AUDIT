// services/reconciliation.service.js
const ReconciliationResult = require('../models/ReconciliationResult');
const Record = require('../models/Record');

const AuditLog = require('../models/AuditLog');

module.exports = async function reconcile(records, jobId, options = {}) {
  if (!records.length) return { MATCHED: 0, PARTIALLY_MATCHED: 0, NOT_MATCHED: 0, DUPLICATE: 0 };

  let TOLERANCE_PERCENT = options.tolerance;

  if (TOLERANCE_PERCENT === undefined) {
    const SystemConfig = require('../models/SystemConfig');
    const varianceConfig = await SystemConfig.findOne({ key: 'reconciliation_variance' });
    TOLERANCE_PERCENT = varianceConfig ? varianceConfig.value : 0.02; // Default to 2%
  }

  // 1. Bulk Fetch Potential Matches
  const transactionIds = records.map(r => r.transactionId).filter(Boolean);
  const refNumbers = records.map(r => r.refNumber).filter(Boolean);

  const candidates = await Record.find({
    _id: { $nin: records.map(r => r._id) },
    $or: [
      { transactionId: { $in: transactionIds } },
      { refNumber: { $in: refNumbers } }
    ]
  }).lean();

  // Index candidates for O(1) lookup
  const candidatesByTxId = new Map();
  const candidatesByRef = new Map();

  candidates.forEach(c => {
    if (c.transactionId) candidatesByTxId.set(c.transactionId, c);
    if (c.refNumber) candidatesByRef.set(c.refNumber, c);
  });

  const reconOps = [];
  const auditOps = [];
  const stats = { MATCHED: 0, PARTIALLY_MATCHED: 0, NOT_MATCHED: 0, DUPLICATE: 0 };

  const seenInBatch = new Set();

  for (const record of records) {
    let status = 'NOT_MATCHED'; // Default
    let matchScore = 0;
    let systemMatch = null;

    // A. Duplicate Check (Transaction ID seen before in this batch)
    if (seenInBatch.has(record.transactionId)) {
      status = 'DUPLICATE';
    } else {
      seenInBatch.add(record.transactionId);

      // B. Try to find exact match by Transaction ID against existing system records
      const existingRecord = candidatesByTxId.get(record.transactionId);
      if (existingRecord && String(existingRecord.uploadJobId) !== String(jobId)) {
        const diff = Math.abs(existingRecord.amount - record.amount);
        if (diff < 0.01) {
          // Exact match on both Transaction ID and Amount
          status = 'MATCHED';
          matchScore = 100;
          systemMatch = existingRecord;
          candidatesByTxId.delete(record.transactionId);
        }
        // If Transaction ID matches but amount differs, leave status as NOT_MATCHED
        // to allow partial match check by reference number
      }
    }

    // C. Partial Match Check (Reference Number based)
    // Only check for partial match if not already matched or duplicate
    if (status === 'NOT_MATCHED' && record.refNumber) {
      const refMatch = candidatesByRef.get(record.refNumber);
      if (refMatch) {
        const diff = Math.abs(refMatch.amount - record.amount);
        const maxDiff = refMatch.amount * TOLERANCE_PERCENT;

        if (diff <= maxDiff) {
          status = 'PARTIALLY_MATCHED';
          matchScore = Math.max(0, 100 - (diff / refMatch.amount) * 100);
          systemMatch = refMatch;
          candidatesByRef.delete(record.refNumber);
        }
      }
    }

    // Update Stats
    stats[status]++;

    // Prepare Reconciliation Result Insert
    reconOps.push({
      insertOne: {
        document: {
          recordId: record._id,
          systemRecordId: systemMatch ? systemMatch._id : null,
          uploadJobId: jobId,
          status,
          matchScore
        }
      }
    });

    // Prepare Audit Log
    let description = '';
    let actionType = '';

    if (status === 'MATCHED') {
      description = 'System matched Transaction ID and Amount';
      actionType = 'SYSTEM_MATCH';
    } else if (status === 'PARTIALLY_MATCHED') {
      const variance = systemMatch ? ((Math.abs(systemMatch.amount - record.amount) / systemMatch.amount) * 100).toFixed(1) : '0.0';
      description = `Reference matched; amount variance ${variance}%`;
      actionType = 'SYSTEM_PARTIAL';
    } else if (status === 'DUPLICATE') {
      description = 'Duplicate Transaction ID detected';
      actionType = 'SYSTEM_DUPLICATE';
    } else {
      description = 'No matching system record found';
      actionType = 'CREATE';
    }

    auditOps.push({
      insertOne: {
        document: {
          recordId: record._id,
          uploadJobId: jobId,
          actionType,
          fieldName: null,
          oldValue: null,
          newValue: { status, matchScore, systemRecordId: systemMatch?._id },
          performedBy: null, // System action
          userEmail: 'SYSTEM',
          userRole: 'SYSTEM',
          source: 'SYSTEM',
          description,
          timestamp: new Date()
        }
      }
    });
  }

  // Execute Bulk Ops
  if (reconOps.length > 0) {
    await ReconciliationResult.bulkWrite(reconOps, { ordered: false });
  }

  if (auditOps.length > 0) {
    await AuditLog.bulkWrite(auditOps, { ordered: false });
  }

  return stats;
};
