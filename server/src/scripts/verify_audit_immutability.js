const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
require('dotenv').config();

async function verifyImmutability() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smart-recon');
        console.log('Connected to MongoDB');

        // 1. Create a log
        const log = await AuditLog.create({
            actionType: 'VERIFY_TEST',
            source: 'SYSTEM',
            description: 'Test log for immutability verification',
            timestamp: new Date()
        });
        console.log('Test log created:', log._id);

        // 2. Try to update it
        try {
            log.description = 'Updated description';
            await log.save();
            console.error('FAIL: Log was updated via save()');
        } catch (err) {
            console.log('SUCCESS: Log update via save() blocked:', err.message);
        }

        try {
            await AuditLog.findByIdAndUpdate(log._id, { description: 'Updated via findByIdAndUpdate' });
            console.error('FAIL: Log was updated via findByIdAndUpdate');
        } catch (err) {
            console.log('SUCCESS: Log update via findByIdAndUpdate blocked:', err.message);
        }

        // 3. Try to delete it
        try {
            await AuditLog.findByIdAndDelete(log._id);
            console.error('FAIL: Log was deleted via findByIdAndDelete');
        } catch (err) {
            console.log('SUCCESS: Log deletion via findByIdAndDelete blocked:', err.message);
        }

        try {
            await AuditLog.deleteMany({ actionType: 'VERIFY_TEST' });
            console.error('FAIL: Log was deleted via deleteMany');
        } catch (err) {
            console.log('SUCCESS: Log deletion via deleteMany blocked:', err.message);
        }

        console.log('Verification finished.');
        process.exit(0);
    } catch (err) {
        console.error('Verification Error:', err);
        process.exit(1);
    }
}

verifyImmutability();
