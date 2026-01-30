import React from 'react';
import { User, Shield, Zap, Terminal, Clock, ArrowRight } from 'lucide-react';

const AuditTimeline = ({ logs }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className="py-12 text-center text-slate-400">
                <Clock className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-sm font-medium">No audit logs found for this record.</p>
            </div>
        );
    }

    const INTERNAL_FIELDS = ['_id', 'uploadJobId', '__v', 'internalId', 'systemId', 'recordId', 'systemRecordId'];

    const filterInternalFields = (val) => {
        if (!val || typeof val !== 'object') return val;
        const filtered = {};
        Object.keys(val).forEach(key => {
            // Exclude common internal fields and anything ending in 'Id' (case insensitive)
            if (!INTERNAL_FIELDS.includes(key) && !key.toLowerCase().endsWith('id')) {
                filtered[key] = val[key];
            }
        });
        return filtered;
    };

    const getChangedFields = (oldVal, newVal) => {
        const oldF = filterInternalFields(oldVal) || {};
        const newF = filterInternalFields(newVal) || {};
        const changes = [];

        const allKeys = new Set([...Object.keys(oldF), ...Object.keys(newF)]);
        allKeys.forEach(key => {
            if (JSON.stringify(oldF[key]) !== JSON.stringify(newF[key])) {
                changes.push({
                    key,
                    from: oldF[key],
                    to: newF[key]
                });
            }
        });
        return changes;
    };

    const formatValue = (val) => {
        if (val === null || val === undefined) return 'N/A';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'CREATE': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'MANUAL_UPDATE': return 'bg-blue-50 text-blue-700 border-blue-100';
            case 'SYSTEM_MATCH': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
            case 'SYSTEM_PARTIAL': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'SYSTEM_DUPLICATE': return 'bg-red-50 text-red-700 border-red-100';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    const getSourceLabel = (source) => {
        switch (source) {
            case 'UI': return 'UI';
            case 'SYSTEM': return 'SYSTEM';
            case 'API': return 'API';
            default: return source;
        }
    };

    const getSourceIcon = (source) => {
        switch (source) {
            case 'UI': return <User size={12} className="text-blue-500" />;
            case 'SYSTEM': return <Terminal size={12} className="text-slate-500" />;
            case 'API': return <Zap size={12} className="text-amber-500" />;
            default: return <Shield size={12} className="text-slate-400" />;
        }
    };

    return (
        <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100" />

            <div className="space-y-8">
                {logs.map((log, idx) => {
                    const changes = getChangedFields(log.oldValue, log.newValue);

                    // Resolve identity: Name -> Email Prefix -> Role -> System
                    let displayName = 'System';
                    if (log.source !== 'SYSTEM') {
                        // Priority 1: Populated name
                        // Priority 2: Populated email prefix
                        // Priority 3: Raw userEmail prefix from log
                        displayName = log.performedBy?.name ||
                            (log.performedBy?.email ? log.performedBy.email.split('@')[0] : null) ||
                            (log.userEmail ? log.userEmail.split('@')[0] : null) ||
                            'User';
                    }

                    return (
                        <div key={log._id || idx} className="relative pl-10">
                            <div className={`absolute left-[13.5px] top-6 w-1.5 h-1.5 rounded-full z-10 ring-4 ring-white ${log.source === 'SYSTEM' ? 'bg-slate-400' : 'bg-blue-500'
                                }`} />

                            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${getActionColor(log.actionType)}`}>
                                                {log.actionType?.replace('_', ' ')}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                                {getSourceIcon(log.source)}
                                                {getSourceLabel(log.source)}
                                            </div>
                                        </div>
                                        <h4 className="text-sm font-bold text-slate-800 leading-tight">
                                            {log.description}
                                        </h4>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap bg-slate-50 px-2 py-1 rounded">
                                        {new Date(log.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                                    <div className="flex items-center gap-1">
                                        <span className="font-bold text-slate-400">By:</span>
                                        <span className="font-medium text-slate-700">
                                            {log.source === 'SYSTEM' ? 'System' : `User (${displayName})`}
                                        </span>
                                        {log.userRole && (
                                            <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold uppercase">
                                                {log.userRole}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {changes.length > 0 && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                                        <div className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2">
                                            <span>Changes Detected</span>
                                            <div className="flex-1 h-px bg-slate-200" />
                                        </div>
                                        {changes.map((change, cIdx) => (
                                            <div key={cIdx} className="grid grid-cols-1 gap-1">
                                                <span className="text-[10px] font-black text-indigo-500 uppercase">{change.key}</span>
                                                <div className="flex items-center gap-3 font-mono text-[11px] overflow-hidden">
                                                    <div className="flex-1 bg-white p-2 rounded border border-slate-200 text-slate-400 line-through truncate">
                                                        {formatValue(change.from)}
                                                    </div>
                                                    <ArrowRight size={14} className="text-slate-300 flex-shrink-0" />
                                                    <div className="flex-1 bg-white p-2 rounded border border-slate-200 text-emerald-600 font-bold truncate">
                                                        {formatValue(change.to)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {changes.length === 0 && log.newValue && (
                                    <div className="mt-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                        <div className="text-[9px] font-black text-slate-300 uppercase mb-1">State Summary</div>
                                        <div className="text-[10px] font-mono text-slate-500 bg-white p-2 rounded border border-slate-100 overflow-x-auto">
                                            {Object.entries(filterInternalFields(log.newValue))
                                                .map(([k, v]) => `${k}: ${formatValue(v)}`)
                                                .join(' | ')}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AuditTimeline;
