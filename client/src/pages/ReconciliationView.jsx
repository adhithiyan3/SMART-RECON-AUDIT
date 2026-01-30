import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getResults, correctRecord, getTimeline } from '../api/record.api';
import { CheckCircle, XCircle, AlertCircle, Copy, History, Edit2, Search, Filter, ArrowLeft, ArrowRight, User as UserIcon, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import AuditTimeline from '../components/AuditTimeline';

export default function ReconciliationView() {
    const { user } = useAuthStore();
    const [searchParams] = useSearchParams();
    const jobId = searchParams.get('jobId');

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('');

    const [selectedResult, setSelectedResult] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [showTimeline, setShowTimeline] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [editFormData, setEditFormData] = useState({});

    useEffect(() => {
        fetchResults();
    }, [jobId, page, statusFilter]);

    const fetchResults = async () => {
        setLoading(true);
        try {
            const res = await getResults({ jobId, status: statusFilter, page });
            setResults(res.data.results);
            setTotalPages(res.data.totalPages);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleShowTimeline = async (recordId) => {
        try {
            const res = await getTimeline(recordId);
            setTimeline(res.data);
            setShowTimeline(true);
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = (result) => {
        setSelectedResult(result);
        setEditFormData({
            amount: result.record.amount,
            refNumber: result.record.refNumber
        });
        setShowEdit(true);
    };

    const submitCorrection = async () => {
        try {
            await correctRecord(selectedResult.record._id, editFormData);
            setShowEdit(false);
            fetchResults(); // Refresh
        } catch (err) {
            alert('Failed to update record');
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'MATCHED': return <CheckCircle className="text-emerald-500" size={18} />;
            case 'PARTIALLY_MATCHED': return <AlertCircle className="text-amber-500" size={18} />;
            case 'NOT_MATCHED': return <XCircle className="text-red-500" size={18} />;
            case 'DUPLICATE': return <Copy className="text-indigo-500" size={18} />;
            default: return null;
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
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">Reconciliation Data</h1>
                        <p className="text-slate-500 text-sm">Reviewing results {jobId ? `for Job #${jobId.slice(-6)}` : ''}</p>
                    </div>

                    <div className="flex gap-4">
                        <select
                            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold shadow-sm outline-none"
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Statuses</option>
                            <option value="MATCHED">Matched</option>
                            <option value="PARTIALLY_MATCHED">Partially Matched</option>
                            <option value="NOT_MATCHED">Not Matched</option>
                            <option value="DUPLICATE">Duplicate</option>
                        </select>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Uploaded Record</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">System Match</th>
                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {results.map((res) => (
                                <tr key={res._id} className="hover:bg-slate-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(res.status)}
                                            <span className={`text-xs font-bold px-2 py-1 rounded-md ${res.status === 'MATCHED' ? 'bg-emerald-50 text-emerald-700' :
                                                res.status === 'PARTIALLY_MATCHED' ? 'bg-amber-50 text-amber-700' :
                                                    res.status === 'DUPLICATE' ? 'bg-indigo-50 text-indigo-700' :
                                                        'bg-red-50 text-red-700'
                                                }`}>
                                                {res.status === 'NOT_MATCHED' ? 'Not Matched' : (res.status === 'PARTIALLY_MATCHED' ? 'Partially Matched' : res.status)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="font-bold text-slate-800 text-sm">{res.record.transactionId}</p>
                                            <div className="flex gap-4 text-xs font-medium text-slate-400">
                                                <span>Amt: <b className="text-slate-600">${res.record.amount}</b></span>
                                                <span>Ref: <b className="text-slate-600">{res.record.refNumber}</b></span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {res.systemRecord ? (
                                            <div className="space-y-1">
                                                <p className="font-bold text-slate-800 text-sm">{res.systemRecord.transactionId}</p>
                                                <div className="flex gap-4 text-xs font-medium text-slate-400">
                                                    <span className={res.status === 'PARTIAL' && res.record.amount !== res.systemRecord.amount ? "text-red-600 bg-red-50 px-1 rounded font-black border border-red-100" : ""}>
                                                        Amt: ${res.systemRecord.amount}
                                                    </span>
                                                    <span className={res.status === 'PARTIAL' && res.record.refNumber !== res.systemRecord.refNumber ? "text-red-600 bg-red-50 px-1 rounded font-black border border-red-100" : ""}>
                                                        Ref: {res.systemRecord.refNumber}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic text-sm">No Match Found</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {user?.role !== 'Viewer' && (
                                                <button onClick={() => handleEdit(res)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Edit Record">
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                            <button onClick={() => handleShowTimeline(res.record._id)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Audit Trail">
                                                <History size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {results.length === 0 && !loading && (
                        <div className="py-20 text-center">
                            <Search className="mx-auto text-slate-200 mb-4" size={48} />
                            <p className="text-slate-400 font-medium">No results found for your search.</p>
                        </div>
                    )}

                    <div className="px-6 py-4 bg-slate-50/50 flex items-center justify-between border-t border-slate-100">
                        <span className="text-sm font-bold text-slate-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30"
                            >
                                <ArrowLeft size={16} />
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-30"
                            >
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Audit Timeline Modal */}
            {showTimeline && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-end">
                    <div className="bg-white h-full w-full max-w-md shadow-2xl p-8 animate-in slide-in-from-right duration-300 overflow-y-auto">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Audit Trail</h2>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Immutable persistence log</p>
                            </div>
                            <button onClick={() => setShowTimeline(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <AuditTimeline logs={timeline} />
                    </div>
                </div>
            )}

            {/* Manual Correction Modal */}
            {showEdit && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 animate-in zoom-in duration-200">
                        <h2 className="text-xl font-black text-slate-900 mb-2">Manual Record Correction</h2>
                        <p className="text-slate-400 text-sm mb-6 font-medium">Updating transaction #{selectedResult.record.transactionId}</p>

                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Amount</label>
                                <input
                                    type="number"
                                    value={editFormData.amount}
                                    onChange={e => setEditFormData(p => ({ ...p, amount: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase mb-2">Reference Number</label>
                                <input
                                    type="text"
                                    value={editFormData.refNumber}
                                    onChange={e => setEditFormData(p => ({ ...p, refNumber: e.target.value }))}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowEdit(false)}
                                className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitCorrection}
                                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
