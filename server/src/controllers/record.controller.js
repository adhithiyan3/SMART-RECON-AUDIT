const Record = require('../models/Record');
const audit = require('../services/audit.service');

exports.correctRecord = async (req, res) => {
  const record = await Record.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ message: 'Record not found' });
  }

  const oldData = record.toObject();
  const newData = req.body;
  const changedFields = [];
  const changes = [];

  if (newData.amount !== undefined && Number(newData.amount) !== oldData.amount) {
    changedFields.push('amount');
    changes.push(`Amount: ${oldData.amount} → ${newData.amount}`);
  }
  if (newData.refNumber !== undefined && newData.refNumber !== oldData.refNumber) {
    changedFields.push('refNumber');
    changes.push(`Ref: ${oldData.refNumber} → ${newData.refNumber}`);
  }

  if (changedFields.length === 0) {
    return res.json({ message: 'No changes detected' });
  }

  await audit.auditAndUpdate({
    recordId: record._id,
    uploadJobId: record.uploadJobId,
    actionType: 'MANUAL_UPDATE',
    fieldName: changedFields.join(', '),
    oldValue: oldData,
    newValue: { ...oldData, ...newData },
    performedBy: req.user.id,
    userEmail: req.user.email,
    userRole: req.user.role,
    source: 'UI',
    description: `Manual correction: ${changes.join(', ')}`
  }, async () => {
    if (newData.amount !== undefined) record.amount = Number(newData.amount);
    if (newData.refNumber !== undefined) record.refNumber = newData.refNumber;
    await record.save();
  });

  res.json({ message: 'Record corrected' });
};
const ReconciliationResult = require('../models/ReconciliationResult');

exports.getReconciliationResults = async (req, res) => {
  const { jobId, status, page = 1, limit = 50 } = req.query;
  const query = {};
  if (jobId) query.uploadJobId = jobId;
  if (status) query.status = status;

  try {
    const results = await ReconciliationResult.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
      .lean();

    // Population manual logic since we don't have refs in schema
    const recordIds = results.map(r => r.recordId);
    const systemIds = results.map(r => r.systemRecordId).filter(Boolean);

    const [uploadedRecords, systemRecords] = await Promise.all([
      Record.find({ _id: { $in: recordIds } }).lean(),
      Record.find({ _id: { $in: systemIds } }).lean()
    ]);

    const uploadedMap = new Map(uploadedRecords.map(r => [r._id.toString(), r]));
    const systemMap = new Map(systemRecords.map(r => [r._id.toString(), r]));

    const populated = results.map(r => ({
      ...r,
      record: uploadedMap.get(r.recordId.toString()),
      systemRecord: r.systemRecordId ? systemMap.get(r.systemRecordId.toString()) : null
    }));

    const count = await ReconciliationResult.countDocuments(query);

    res.json({
      results: populated,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

exports.getRecordTimeline = async (req, res) => {
  try {
    const logs = await AuditLog.find({ recordId: req.params.id })
      .populate('performedBy', 'name email')
      .sort({ timestamp: 1 })
      .lean();

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
