const ReconciliationResult = require('../models/ReconciliationResult');

exports.summary = async (req, res) => {
  const { startDate, endDate, status, userId } = req.query;
  const match = {};

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      match.createdAt.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      match.createdAt.$lte = end;
    }
  }

  if (status) match.status = status;

  if (userId) {
    const UploadJob = require('../models/UploadJob');
    const jobs = await UploadJob.find({ userId }).select('_id');
    match.uploadJobId = { $in: jobs.map(j => j._id) };
  }

  const data = await ReconciliationResult.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Convert to keyed object for easier frontend use
  const stats = {
    MATCHED: 0,
    PARTIALLY_MATCHED: 0,
    NOT_MATCHED: 0,
    DUPLICATE: 0,
    TOTAL: 0
  };

  data.forEach(d => {
    // d._id is the status string from DB which is now MATCHED, PARTIALLY_MATCHED, NOT_MATCHED, DUPLICATE
    stats[d._id] = d.count;
    stats.TOTAL += d.count;
  });

  stats.accuracy = stats.TOTAL > 0 ? (stats.MATCHED / stats.TOTAL) * 100 : 0;

  res.json(stats);
};

exports.getUsers = async (req, res) => {
  try {
    const User = require('../models/User');
    // For simplicity, return all users with Analyst or Admin roles
    const users = await User.find({ role: { $in: ['Analyst', 'Admin'] } }).select('email role');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
