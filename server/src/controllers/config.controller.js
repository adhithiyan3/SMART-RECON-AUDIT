const SystemConfig = require('../models/SystemConfig');

exports.getConfigs = async (req, res) => {
    try {
        const configs = await SystemConfig.find();
        res.json(configs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateConfig = async (req, res) => {
    try {
        const { key, value } = req.body;

        const oldConfig = await SystemConfig.findOne({ key });
        const oldVal = oldConfig ? oldConfig.value : null;

        const config = await SystemConfig.findOneAndUpdate(
            { key },
            { value },
            { upsert: true, new: true }
        );

        // Create Audit Log
        const AuditLog = require('../models/AuditLog');
        await AuditLog.create({
            actionType: 'CONFIG_UPDATE',
            fieldName: key,
            oldValue: oldVal,
            newValue: value,
            performedBy: req.user.id,
            userEmail: req.user.email,
            userRole: req.user.role,
            source: 'UI',
            description: `System configuration '${key}' updated`,
            timestamp: new Date()
        });

        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Initialize default configs
exports.initializeDefaults = async () => {
    const defaults = [
        { key: 'reconciliation_variance', value: 0.02, description: 'Amount variance for partial matching (e.g., 0.02 for 2%)' },
        { key: 'matching_rules', value: ['EXACT_TX_ID', 'PARTIAL_REF_NO'], description: 'Enabled matching strategies' }
    ];

    for (const d of defaults) {
        await SystemConfig.findOneAndUpdate({ key: d.key }, d, { upsert: true });
    }
};
