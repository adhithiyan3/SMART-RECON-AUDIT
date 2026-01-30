const fs = require('fs');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const Record = require('../models/Record');
const UploadJob = require('../models/UploadJob');
const reconcile = require('../services/reconciliation.service');
const SystemConfig = require('../models/SystemConfig');

module.exports = async (job) => {
  const { jobId, filePath, fileName, mapping } = job.data;

  let failed = 0;
  let batch = [];
  const BATCH_SIZE = 1000;

  try {
    // 1. Reset job stats & Clear old data for idempotency
    await UploadJob.findByIdAndUpdate(jobId, {
      processed: 0,
      totalMatched: 0,
      totalPartial: 0,
      totalUnmatched: 0,
      totalDuplicate: 0,
      failed: 0,
      status: 'PROCESSING'
    });

    const ReconciliationResult = require('../models/ReconciliationResult');
    const AuditLog = require('../models/AuditLog');

    // Clear existing data EXCEPT Audit Logs for this job to ensure a clean slate while preserving history
    await Record.deleteMany({ uploadJobId: jobId });
    await ReconciliationResult.deleteMany({ uploadJobId: jobId });

    const varianceConfig = await SystemConfig.findOne({ key: 'reconciliation_variance' });
    const tolerance = varianceConfig ? varianceConfig.value : 0.02;

    const fileToProcess = fileName || filePath || '';
    const isExcel = fileToProcess.endsWith('.xlsx') || fileToProcess.endsWith('.xls');

    if (isExcel && fileToProcess.endsWith('.xlsx')) {
      console.log(`Starting ExcelJS stream for job ${jobId}`);
      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
        entries: 'emit',
        sharedStrings: 'cache',
        worksheets: 'emit'
      });

      await new Promise((resolve, reject) => {
        workbookReader.on('error', (err) => {
          console.error('WorkbookReader Error:', err);
          reject(err);
        });

        workbookReader.on('worksheet', (worksheetReader) => {
          let headers = [];
          let rowCount = 0;

          worksheetReader.on('row', async (row) => {
            rowCount++;
            if (rowCount === 1) {
              // Extract and trim headers (1-indexed for ExcelJS)
              headers = Array.isArray(row.values) ? row.values.map(v => (typeof v === 'string' ? v.trim() : v)) : [];
              console.log(`Job ${jobId}: Found headers:`, headers.filter(Boolean));
              return;
            }

            try {
              const rowData = {};
              row.values.forEach((val, idx) => {
                const header = headers[idx];
                if (header) {
                  // Resolve formulas or objects to raw values
                  let finalVal = val;
                  if (val && typeof val === 'object') {
                    if (val.result !== undefined) finalVal = val.result;
                    else if (val.text !== undefined) finalVal = val.text;
                    else if (val.richText !== undefined) finalVal = val.richText.map(t => t.text).join('');
                  }
                  rowData[header] = finalVal;
                }
              });

              const record = parseRow(rowData, mapping, jobId);
              if (record) {
                batch.push(record);
              }

              if (batch.length >= BATCH_SIZE) {
                const currentBatch = [...batch];
                batch = [];
                await processBatch(currentBatch, jobId, { tolerance });
              }
            } catch (err) {
              console.error(`Row ${rowCount} error:`, err);
              failed++;
            }
          });

          worksheetReader.on('end', () => {
            console.log(`Job ${jobId}: Worksheet ${worksheetReader.name} end. Processed rows: ${rowCount}`);
          });

          worksheetReader.on('error', (err) => {
            console.error('WorksheetReader Error:', err);
          });
        });

        workbookReader.on('end', () => {
          console.log(`Job ${jobId}: Excel reader finished.`);
          resolve();
        });
        workbookReader.read();
      });
    } else if (isExcel) {
      // Legacy Excel (.xls) or other formats - fallback to non-streaming for now
      // since ExcelJS streaming only supports .xlsx
      const XLSX_LEGACY = require('xlsx');
      const workbook = XLSX_LEGACY.readFile(filePath);
      const rows = XLSX_LEGACY.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      console.log(`Job ${jobId}: Processing legacy Excel with ${rows.length} rows`);

      for (const row of rows) {
        const record = parseRow(row, mapping, jobId);
        if (record) batch.push(record);
        if (batch.length >= BATCH_SIZE) {
          await processBatch(batch, jobId, { tolerance });
          batch = [];
        }
      }
    } else {
      // 2. TRUE STREAMING for CSV
      console.log(`Starting CSV stream for job ${jobId}`);
      // Use csv-parser with automatic delimiter detection or common fallbacks if needed
      const stream = fs.createReadStream(filePath).pipe(csv({
        mapHeaders: ({ header }) => header.trim(),
        skipLines: 0
      }));

      for await (const row of stream) {
        try {
          // Check if it's an empty row or has no transactionId
          const record = parseRow(row, mapping, jobId);
          if (record) {
            batch.push(record);
          }

          if (batch.length >= BATCH_SIZE) {
            const currentBatch = [...batch];
            batch = [];
            await processBatch(currentBatch, jobId, { tolerance });
          }
        } catch (err) {
          failed++;
        }
      }
      console.log(`Job ${jobId}: CSV stream finished.`);
    }

    // Process final batch
    if (batch.length) {
      await processBatch(batch, jobId, { tolerance });
    }

    await UploadJob.findByIdAndUpdate(jobId, {
      status: 'COMPLETED',
      failed
    });
  } catch (err) {
    console.error('Processor Error:', err);
    await UploadJob.findByIdAndUpdate(jobId, { status: 'FAILED' });
  } finally {
    // Optional: cleanup temporary file if desired
    // if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

function parseRow(row, mapping, jobId) {
  const transactionId = row[mapping.transactionId];
  if (!transactionId) return null;

  return {
    uploadJobId: jobId,
    transactionId: String(transactionId).trim(),
    refNumber: row[mapping.refNumber] ? String(row[mapping.refNumber]).trim() : '',
    amount: parseFloat(String(row[mapping.amount] || '0').replace(/[^0-9.-]+/g, "")),
    date: new Date(row[mapping.date])
  };
}

async function processBatch(batch, jobId, options) {
  try {
    // Insert Records - ordered: false allows some to fail (duplicates) while others succeed
    let docs = [];

    try {
      docs = await Record.insertMany(batch, { ordered: false });
    } catch (err) {
      if (err.name === 'MongoBulkWriteError') {
        // Some inserted, some failed (likely duplicates)
        // We still need to reconcile the ones that now exist in DB
        const txIds = batch.map(b => b.transactionId);
        docs = await Record.find({ transactionId: { $in: txIds } }).lean();
      } else {
        throw err;
      }
    }

    // Perform Reconciliation in memory for the batch
    const batchStats = await reconcile(docs, jobId, options);

    // Update Job Metadata in Bulk
    await UploadJob.findByIdAndUpdate(jobId, {
      $inc: {
        processed: batch.length, // Total records processed in this batch
        totalMatched: batchStats.MATCHED,
        totalPartial: batchStats.PARTIALLY_MATCHED,
        totalUnmatched: batchStats.NOT_MATCHED,
        totalDuplicate: batchStats.DUPLICATE
      }
    });
  } catch (err) {
    console.error('Batch Processing Error:', err);
  }
}
