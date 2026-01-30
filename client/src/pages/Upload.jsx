import { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { uploadFile, submitMapping, getJobStatus, getUploadHistory } from '../api/upload.api';
import { useUploadStore } from '../store/upload.store';
import { FileText, CheckCircle2, AlertCircle, Clock, History, Edit3, ArrowRight, RefreshCw } from 'lucide-react';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({
    transactionId: '',
    amount: '',
    refNumber: '',
    date: ''
  });
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [step, setStep] = useState('UPLOAD'); // UPLOAD, PREVIEW, MAPPING, PROCESSING
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const fileInputRef = useRef(null);

  const MANDATORY_FIELDS = [
    { key: 'transactionId', label: 'Transaction ID' },
    { key: 'amount', label: 'Amount' },
    { key: 'refNumber', label: 'Reference Number' },
    { key: 'date', label: 'Date' }
  ];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile) => {
    if (!selectedFile.name.match(/\.(csv|xlsx|xls)$/)) {
      setError('Please upload a CSV or Excel file');
      return;
    }

    setFile(selectedFile);
    setError('');
    setIsDuplicate(false);

    // Generate SHA-256 hash of the file content
    const generateHash = async (file) => {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // Quick duplicate check before processing further preview
    try {
      const fileHash = await generateHash(selectedFile);
      const { checkDuplicate } = await import('../api/upload.api');
      const res = await checkDuplicate(fileHash);
      if (res.data.exists) {
        setIsDuplicate(res.data.jobId);
        setError('⚠️ This exact file content has already been uploaded. Please reprocess the existing upload or upload a modified file.');
      }
    } catch (err) {
      console.error('Duplicate check failed', err);
    }

    const reader = new FileReader();

    if (selectedFile.name.endsWith('.csv')) {
      Papa.parse(selectedFile, {
        header: true,
        preview: 20,
        complete: (results) => {
          setPreview(results.data);
          setHeaders(results.meta.fields || []);
          setStep('PREVIEW');
        }
      });
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', sheetRows: 21 });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        const headers = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
        setPreview(json);
        setHeaders(headers);
        setStep('PREVIEW');
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleUploadAndGetId = async () => {
    setLoading(true);
    try {
      const res = await uploadFile(file);
      const { jobId, status, reused } = res.data;

      setJobId(jobId);
      useUploadStore.getState().setActiveJobId(jobId);

      if (reused) {
        setHeaders(res.data.headers || []);
        if (status === 'COMPLETED' || status === 'FAILED') {
          setStep('PROCESSING');
        } else {
          setStep('MAPPING');
        }
      } else {
        setStep('MAPPING');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
      loadHistory();
    }
  };

  const handleStartProcessing = async () => {
    if (Object.values(mapping).some(v => !v)) {
      setError('Please map all mandatory fields');
      return;
    }

    setLoading(true);
    try {
      await submitMapping(jobId, mapping);
      setStep('PROCESSING');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start processing');
    } finally {
      setLoading(false);
      loadHistory();
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getUploadHistory();
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleEditMapping = (job) => {
    const targetId = job._id || job.jobId;
    setJobId(targetId);
    setMapping({
      transactionId: job.columnMapping?.transactionId || '',
      amount: job.columnMapping?.amount || '',
      refNumber: job.columnMapping?.refNumber || '',
      date: job.columnMapping?.date || ''
    });

    if (job.headers && job.headers.length > 0) {
      setHeaders(job.headers);
      setPreview(job.preview || []);
      setStep('MAPPING');
    } else {
      getJobStatus(targetId).then(res => {
        setHeaders(res.data.headers || []);
        setPreview(res.data.preview || []);
        setStep('MAPPING');
      });
    }
  };

  const STATUS_LABELS = {
    'PENDING_MAPPING': 'Awaiting Mapping',
    'VALIDATING': 'Validating File',
    'PROCESSING': 'Reconciling Transactions',
    'COMPLETED': 'Reconciliation Complete',
    'FAILED': 'Processing Failed'
  };

  useEffect(() => {
    if (!jobId) return;

    const fetchStatus = async () => {
      try {
        const res = await getJobStatus(jobId);
        setJobData(res.data);
        if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
          loadHistory(); // Refresh history when a job finishes
          return true;
        }
      } catch (err) {
        setError('Failed to fetch job status');
        return true;
      }
      return false;
    };

    fetchStatus();
    const interval = setInterval(async () => {
      const stop = await fetchStatus();
      if (stop) clearInterval(interval);
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  useEffect(() => {
    const rehydrate = async () => {
      const storedJobId = useUploadStore.getState().activeJobId;
      if (!storedJobId) return;

      try {
        setLoading(true);
        const res = await getJobStatus(storedJobId);
        const data = res.data;

        setJobId(data.jobId);
        setJobData(data);
        setHeaders(data.headers || []);
        setPreview(data.preview || []);

        if (data.columnMapping) {
          setMapping({
            transactionId: data.columnMapping.transactionId || '',
            amount: data.columnMapping.amount || '',
            refNumber: data.columnMapping.refNumber || '',
            date: data.columnMapping.date || ''
          });
        }

        if (data.status === 'PENDING_MAPPING' || data.status === 'VALIDATING') {
          setStep('MAPPING');
        } else {
          setStep('PROCESSING');
        }
      } catch (err) {
        console.error('Failed to rehydrate upload state', err);
        useUploadStore.getState().setActiveJobId(null);
      } finally {
        setLoading(false);
      }
    };

    rehydrate();
    loadHistory();
  }, []);

  const StatusIcon = ({ status }) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'FAILED': return <AlertCircle className="text-red-500" size={20} />;
      case 'PROCESSING': return <RefreshCw className="text-blue-500 animate-spin" size={20} />;
      default: return <Clock className="text-slate-400" size={20} />;
    }
  };

  const getRelativeTime = (date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInSeconds = Math.floor((now - past) / 1000);

    if (diffInSeconds < 60) return 'Just now';

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} ${diffInMinutes === 1 ? 'min' : 'mins'} ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            Reconciliation Center
          </h1>
          <p className="text-lg text-slate-600 font-medium">Manage uploads, map columns, and track processing in real-time.</p>
        </div>

        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl flex items-center gap-3">
            <AlertCircle className="text-red-500" />
            <p className="text-red-700 font-bold">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Upload & Mapping */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 min-h-[500px] flex flex-col">
              <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-6">
                <div className="flex justify-between items-center">
                  <div className="flex gap-8">
                    {['Upload', 'Preview', 'Mapping', 'Status'].map((s, i) => (
                      <div key={s} className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${['UPLOAD', 'PREVIEW', 'MAPPING', 'PROCESSING'].indexOf(step) >= i ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                          }`}>{i + 1}</div>
                        <span className={`ml-2 text-sm font-bold hidden sm:inline ${['UPLOAD', 'PREVIEW', 'MAPPING', 'PROCESSING'].indexOf(step) >= i ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                  {step !== 'UPLOAD' && (
                    <button
                      onClick={() => {
                        setStep('UPLOAD');
                        setFile(null);
                        setJobId(null);
                        setJobData(null);
                        setPreview([]);
                        setHeaders([]);
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RefreshCw size={12} /> New Upload
                    </button>
                  )}
                </div>
              </div>

              <div className="p-8 flex-grow flex flex-col justify-center">
                {step === 'UPLOAD' && (
                  <div
                    className={`border-2 border-dashed border-slate-200 rounded-2xl p-16 text-center hover:bg-blue-50/30 cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => !loading && fileInputRef.current?.click()}
                  >
                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileChange} disabled={loading} />
                    <h3 className="text-xl font-bold mb-2">Drop your file here</h3>
                    <p className="text-slate-500 mb-8">Supports CSV, Excel up to 50,000 records.</p>
                    <button className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold" disabled={loading}>
                      {loading ? 'Processing...' : 'Browse Files'}
                    </button>
                  </div>
                )}

                {step === 'PREVIEW' && (
                  <div>
                    <div className="flex justify-between mb-4">
                      <h3 className="text-xl font-bold">File Preview</h3>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl mb-6">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                          <tr>{headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {preview.slice(0, 20).map((row, i) => (
                            <tr key={i}>{headers.map(h => <td key={h} className="px-4 py-3 text-sm text-slate-600 truncate max-w-[150px]">{row[h]?.toString()}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end gap-4">
                      {isDuplicate && (
                        <button
                          onClick={() => {
                            setJobId(isDuplicate);
                            setStep('PROCESSING');
                            useUploadStore.getState().setActiveJobId(isDuplicate);
                          }}
                          className="px-8 py-3 bg-indigo-100 text-indigo-700 rounded-xl font-bold hover:bg-indigo-200 transition-colors"
                        >
                          View Existing Result
                        </button>
                      )}
                      <button onClick={handleUploadAndGetId} disabled={loading || jobId} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? 'Uploading...' : jobId ? 'Uploaded' : isDuplicate ? 'Reprocess Anyway' : 'Confirm and Map'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'MAPPING' && (
                  <div>
                    <h3 className="text-xl font-bold mb-6">Column Mapping</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {MANDATORY_FIELDS.map(f => (
                        <div key={f.key}>
                          <label className="block text-sm font-bold mb-2">{f.label}</label>
                          <select
                            value={mapping[f.key]}
                            onChange={(e) => setMapping(p => ({ ...p, [f.key]: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-4 py-3"
                          >
                            <option value="">Select Header</option>
                            {headers.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between">
                      <button
                        onClick={() => setStep('PREVIEW')}
                        disabled={loading || jobData?.status === 'PROCESSING'}
                        className="text-slate-500 font-bold disabled:opacity-30"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleStartProcessing}
                        disabled={loading || jobData?.status === 'PROCESSING'}
                        className="px-8 py-3 bg-green-600 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Starting...' : jobData?.status === 'PROCESSING' ? 'Processing...' : 'Start Processing'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 'PROCESSING' && jobData && (
                  <div className="text-center py-8">
                    <h3 className="text-2xl font-bold mb-4">{STATUS_LABELS[jobData.status]}</h3>
                    <div className="mb-6 flex flex-col items-center">
                      <div className="w-full max-w-md bg-slate-100 rounded-full h-4 mb-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${jobData.status === 'COMPLETED' ? 'bg-green-500 w-full' : 'bg-blue-600 animate-pulse w-2/3'}`}
                        ></div>
                      </div>
                      <p className="text-slate-500">Processed: {jobData.processed} records</p>
                    </div>

                    {jobData.latestRecord && jobData.status === 'PROCESSING' && (
                      <div className="mb-8 p-6 bg-blue-50/50 rounded-2xl border border-blue-100 max-w-md mx-auto">
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">Current Record</p>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-700">{jobData.latestRecord.transactionId}</span>
                          <span className="text-blue-700 font-bold">₹{jobData.latestRecord.amount.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Ref: {jobData.latestRecord.refNumber}</p>
                      </div>
                    )}

                    {jobData.status === 'COMPLETED' && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <div className="bg-blue-50 p-4 rounded-xl font-bold text-blue-700">Matched: {jobData.totalMatched}</div>
                        <div className="bg-emerald-50 p-4 rounded-xl font-bold text-emerald-700">Partial: {jobData.totalPartial}</div>
                        <div className="bg-amber-50 p-4 rounded-xl font-bold text-amber-700">Unmatched: {jobData.totalUnmatched}</div>
                        <div className="bg-indigo-50 p-4 rounded-xl font-bold text-indigo-700">Accuracy: {Math.round((jobData.totalMatched / (jobData.processed || 1)) * 100)}%</div>
                      </div>
                    )}
                    <div className="flex justify-center gap-4">
                      {(jobData.status === 'COMPLETED' || jobData.status === 'FAILED') && (
                        <button
                          onClick={() => handleEditMapping(jobData)}
                          className="inline-flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-indigo-100"
                        >
                          <Edit3 size={18} /> Edit Mapping
                        </button>
                      )}
                      <button onClick={() => {
                        setStep('UPLOAD');
                        setFile(null);
                        setJobData(null);
                        setJobId(null);
                        useUploadStore.getState().setActiveJobId(null);
                      }} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors">
                        Upload Another
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Process History & Active Card */}
          <div className="space-y-8">
            {/* Active Status Card (Always visible if job exists) */}
            {jobData && (
              <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800">Current Process</h3>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${jobData.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : jobData.status === 'FAILED' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    {jobData.status}
                  </span>
                </div>

                <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-2xl">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <FileText className="text-blue-600" size={24} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-700 truncate">{jobData.fileName}</p>
                    <p className="text-xs text-slate-400 font-medium">ID: {jobData.jobId.slice(-8)}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Progress</span>
                    <span>{jobData.processed} records</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${jobData.status === 'COMPLETED' ? 'bg-emerald-500 w-full' : 'bg-blue-600 animate-pulse w-2/3'}`}
                    ></div>
                  </div>
                </div>

                {(jobData.status === 'COMPLETED' || jobData.status === 'FAILED') && step === 'PROCESSING' && (
                  <button
                    onClick={() => handleEditMapping(jobData)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors mb-2"
                  >
                    <Edit3 size={16} /> Edit Mapping
                  </button>
                )}
              </div>
            )}

            {/* Process History Log */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden flex flex-col max-h-[600px]">
              <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <History size={20} className="text-slate-400" />
                  Upload Log
                </h3>
                <button onClick={loadHistory} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
                  <RefreshCw size={16} className={historyLoading ? 'animate-spin' : 'text-slate-400'} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-2">
                {historyLoading ? (
                  <div className="p-10 text-center space-y-3">
                    <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Logs</p>
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-10 text-center text-slate-400">
                    <p className="text-sm font-medium">No previous uploads found.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {history.map(item => (
                      <div
                        key={item._id}
                        className={`group p-4 rounded-2xl transition-all hover:bg-slate-50 border border-transparent ${jobId === item._id ? 'bg-blue-50/50 border-blue-100' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <StatusIcon status={item.status} />
                            <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{item.fileName}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {item.processed} records · {getRelativeTime(item.createdAt)}
                          </span>
                          <div className="flex gap-2">
                            {(item.status === 'COMPLETED' || item.status === 'FAILED') && (
                              <button
                                onClick={() => handleEditMapping(item)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Mapping"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setJobId(item._id);
                                setStep('PROCESSING');
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
