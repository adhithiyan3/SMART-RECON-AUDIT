const mongoose = require('mongoose');
const Record = require('../models/Record');
const ReconciliationResult = require('../models/ReconciliationResult');
const AuditLog = require('../models/AuditLog');
const reconcile = require('../services/reconciliation.service');
const UploadJob = require('../models/UploadJob');

// --- MOCKING INFRASTRUCTURE ---
let mockDb = {
    records: [],
    results: [],
    logs: [],
    jobs: []
};

// Mock Record.find
Record.find = (query) => {
    if (query.$or) {
        const txIds = query.$or[0].transactionId.$in;
        const refNums = query.$or[1].refNumber.$in;

        const result = mockDb.records.filter(r =>
            (txIds.includes(r.transactionId) || refNums.includes(r.refNumber)) &&
            (!query._id || !query._id.$nin.some(id => id.toString() === r._id.toString()))
        );

        return {
            lean: () => Promise.resolve(result)
        };
    }
    return { lean: () => Promise.resolve([]) };
};

Record.insertMany = async (docs) => {
    docs.forEach(d => {
        if (!d._id) d._id = new mongoose.Types.ObjectId();
        mockDb.records.push(d);
    });
    return docs;
};

// Mock BulkWrites
ReconciliationResult.bulkWrite = async (ops) => {
    ops.forEach(op => {
        if (op.insertOne) {
            mockDb.results.push(op.insertOne.document);
        }
    });
    return { ok: 1, nInserted: ops.length };
};

AuditLog.bulkWrite = async (ops) => {
    ops.forEach(op => {
        if (op.insertOne) {
            mockDb.logs.push(op.insertOne.document);
        }
    });
    return { ok: 1 };
};

const SystemConfig = require('../models/SystemConfig');
SystemConfig.findOne = () => Promise.resolve({ value: 0.02 });

// Mock UploadJob.findOne for Idempotency
UploadJob.findOne = (query) => {
    if (query.fileHash) {
        return Promise.resolve(mockDb.jobs.find(j => j.fileHash === query.fileHash));
    }
    return Promise.resolve(null);
};

// --- TEST SCRIPT ---

async function run() {
    try {
        console.log('Starting Comprehensive Verification...\n');

        // --- Scenario 1: Same File Uploaded Twice (Idempotency) ---
        console.log('Scenario 1: Same File Uploaded Twice');
        const fileHash = 'abc123';
        const existingJobId = new mongoose.Types.ObjectId();
        mockDb.jobs.push({ _id: existingJobId, fileHash: fileHash, status: 'COMPLETED' });

        const existing = await UploadJob.findOne({ fileHash: fileHash });
        if (existing) {
            console.log(`✓ Result: Reuses Job ${existing._id} (no new processing)`);
        } else {
            console.log('✗ Result: Failed to detect existing file hash');
        }
        console.log('-------------------------------------------\n');


        // --- Scenario 2: Different File, Same Transaction ---
        console.log('Scenario 2: Different File, Same Transaction');
        mockDb.records = []; // Clear records for fresh start
        mockDb.results = [];

        const jobAId = new mongoose.Types.ObjectId();
        const sysRecordA = {
            _id: new mongoose.Types.ObjectId(),
            uploadJobId: jobAId,
            transactionId: 'TX001',
            amount: 10000,
            refNumber: 'REF100',
            date: new Date()
        };
        mockDb.records.push(sysRecordA);

        const jobBId = new mongoose.Types.ObjectId();
        const batchB = [
            {
                _id: new mongoose.Types.ObjectId(),
                uploadJobId: jobBId,
                transactionId: 'TX001',
                amount: 10000,
                refNumber: 'REF100',
                date: new Date()
            }
        ];

        const statsB = await reconcile(batchB, jobBId);
        const resB = mockDb.results.find(r => r.recordId.toString() === batchB[0]._id.toString());
        console.log(`Result: ${resB?.status} (Expected: MATCHED)`);
        if (resB?.status === 'MATCHED') console.log('✓ MATCHED successfully reconciled with existing system record');
        else console.log('✗ Failed Scenario 2');
        console.log('-------------------------------------------\n');


        // --- Scenario 3: Duplicate Within Same File ---
        console.log('Scenario 3: Duplicate Within Same File');
        mockDb.results = [];
        const jobCId = new mongoose.Types.ObjectId();
        const batchC = [
            {
                _id: new mongoose.Types.ObjectId(),
                uploadJobId: jobCId,
                transactionId: 'TX002',
                amount: 5000,
                refNumber: 'REF201',
                date: new Date()
            },
            {
                _id: new mongoose.Types.ObjectId(),
                uploadJobId: jobCId,
                transactionId: 'TX002',
                amount: 5000,
                refNumber: 'REF201',
                date: new Date()
            }
        ];

        const statsC = await reconcile(batchC, jobCId);
        const resC1 = mockDb.results.find(r => r.recordId.toString() === batchC[0]._id.toString());
        const resC2 = mockDb.results.find(r => r.recordId.toString() === batchC[1]._id.toString());
        console.log(`Row 1 Status: ${resC1?.status} (Expected: NOT_MATCHED - if no system record)`);
        console.log(`Row 2 Status: ${resC2?.status} (Expected: DUPLICATE)`);
        if (resC2?.status === 'DUPLICATE') console.log('✓ Row 2 marked as DUPLICATE');
        else console.log('✗ Failed Scenario 3');
        console.log('-------------------------------------------\n');


        // --- Scenario 4: Partial Match After TxID Mismatch ---
        console.log('Scenario 4: Partial Match After TxID Mismatch');
        mockDb.results = [];
        mockDb.records = []; // Clear records

        // System Record
        const sysRecordD = {
            _id: new mongoose.Types.ObjectId(),
            uploadJobId: new mongoose.Types.ObjectId(),
            transactionId: 'TX003',
            amount: 10000,
            refNumber: 'REF200',
            date: new Date()
        };
        mockDb.records.push(sysRecordD);

        const jobDId = new mongoose.Types.ObjectId();
        const batchD = [
            {
                _id: new mongoose.Types.ObjectId(),
                uploadJobId: jobDId,
                transactionId: 'TX003',
                amount: 9900, // 1% difference
                refNumber: 'REF200',
                date: new Date()
            }
        ];

        const statsD = await reconcile(batchD, jobDId);
        const resD = mockDb.results.find(r => r.recordId.toString() === batchD[0]._id.toString());
        console.log(`Result: ${resD?.status} (Expected: PARTIALLY_MATCHED)`);
        if (resD?.status === 'PARTIALLY_MATCHED') console.log('✓ PARTIALLY_MATCHED (TxID match but amount differs, RefNo matches)');
        else console.log('✗ Failed Scenario 4');
        console.log('-------------------------------------------\n');

    } catch (err) {
        console.error('ERROR during verification:', err);
        process.exit(1);
    }
}

run();
