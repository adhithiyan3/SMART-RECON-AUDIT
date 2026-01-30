const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    description: String
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
