import { useEffect, useState } from 'react';
import { getSummary, getUsers } from '../api/dashboard.api';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { User as UserIcon, Calendar, Filter, RefreshCcw, ArrowUpRight, TrendingUp, CheckCircle, AlertCircle, Clock, Copy } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useUploadStore } from '../store/upload.store';
import { getJobStatus, getActiveJob } from '../api/upload.api';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    userId: ''
  });
  const { activeJobId, setActiveJobId } = useUploadStore();
  const [activeJobData, setActiveJobData] = useState(null);

  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getSummary(filters);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const res = await getUsers();
        setUsers(res.data);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    loadUsers();
  }, []);

  useEffect(() => {
    fetchStats();
  }, [filters]);

  useEffect(() => {
    const checkActiveJob = async () => {
      try {
        const res = await getActiveJob();
        if (res.data) {
          setActiveJobId(res.data.jobId);
          setActiveJobData(res.data);
        }
      } catch (err) {
        console.error('Failed to check active job', err);
      }
    };
    if (!activeJobId) checkActiveJob();
  }, []);

  useEffect(() => {
    if (!activeJobId) {
      setActiveJobData(null);
      return;
    }

    const poll = async () => {
      try {
        const res = await getJobStatus(activeJobId);
        setActiveJobData(res.data);
        fetchStats(true); // Silent background update

        if (res.data.status === 'COMPLETED' || res.data.status === 'FAILED') {
          setActiveJobId(null);
          fetchStats(); // Final non-silent refresh
        }
      } catch (err) {
        console.error('Polling failed', err);
        setActiveJobId(null);
      }
    };

    poll(); // Initial poll
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  const COLORS = {
    MATCHED: '#10b981', // emerald-500
    PARTIAL: '#f59e0b', // amber-500
    UNMATCHED: '#ef4444', // red-500
    DUPLICATE: '#6366f1'  // indigo-500
  };

  const chartData = stats ? [
    { name: 'Matched', value: stats.MATCHED || 0, color: COLORS.MATCHED },
    { name: 'Partial', value: stats.PARTIALLY_MATCHED || 0, color: COLORS.PARTIAL },
    { name: 'Unmatched', value: stats.NOT_MATCHED || 0, color: COLORS.UNMATCHED },
    { name: 'Duplicate', value: stats.DUPLICATE || 0, color: COLORS.DUPLICATE },
  ] : [];

  const AccuracyBadge = ({ value }) => (
    <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full font-bold text-sm">
      <TrendingUp size={16} />
      {Math.round(value)}% Accuracy
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-indigo-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-indigo-100 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
      <div className="max-w-7xl mx-auto">
        {/* Header & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Analytics Dashboard</h1>
            <p className="text-slate-500 font-medium">Real-time overview of reconciliation performance.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 px-3 py-2 border-r border-slate-100">
              <Calendar size={18} className="text-slate-400" />
              <input
                type="date"
                value={filters.startDate}
                max={filters.endDate}
                onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0"
              />
              <span className="text-slate-300">to</span>
              <input
                type="date"
                value={filters.endDate}
                min={filters.startDate}
                onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0"
              />
            </div>

            <div className="flex items-center gap-2 px-3 py-2">
              <Filter size={18} className="text-slate-400" />
              <select
                value={filters.status}
                onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0"
              >
                <option value="">All Statuses</option>
                <option value="MATCHED">Matched</option>
                <option value="PARTIALLY_MATCHED">Partially Matched</option>
                <option value="NOT_MATCHED">Not Matched</option>
                <option value="DUPLICATE">Duplicate</option>
              </select>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 border-r border-slate-100">
              <UserIcon size={18} className="text-slate-400" />
              <select
                value={filters.userId}
                onChange={e => setFilters(p => ({ ...p, userId: e.target.value }))}
                className="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0"
              >
                <option value="">All Users</option>
                {users.map(u => (
                  <option key={u._id} value={u._id}>{u.email}</option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchStats}
              className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
          <StatCard
            title="Total Records"
            value={stats?.TOTAL}
            icon={<Clock className="text-blue-600" />}
            color="bg-blue-50"
            subText="Processed records"
          />
          <StatCard
            title="Exact Matches"
            value={stats?.MATCHED}
            icon={<CheckCircle className="text-emerald-600" />}
            color="bg-emerald-50"
            trend={stats?.accuracy}
            isAccuracy
          />
          <StatCard
            title="Partial"
            value={stats?.PARTIALLY_MATCHED}
            icon={<AlertCircle className="text-amber-600" />}
            color="bg-amber-50"
            subText="Outside 2% variance"
          />
          <StatCard
            title="Not Matched"
            value={stats?.NOT_MATCHED || 0}
            icon={<AlertCircle className="text-red-600" />}
            color="bg-red-50"
            subText="No match found"
          />
          <StatCard
            title="Duplicates"
            value={stats?.DUPLICATE || 0}
            icon={<Copy className="text-indigo-600" />}
            color="bg-indigo-50"
            subText="Repeated IDs"
          />
        </div>

        {/* Charts & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-slate-800">Distribution Overview</h3>
              <AccuracyBadge value={stats?.accuracy || 0} />
            </div>

            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60} label={{ position: 'top', fill: '#64748b', fontSize: 12 }}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <h3 className="text-xl font-bold text-slate-800 mb-8">Status Composition</h3>
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer>
                <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={chartData}
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={8}
                    dataKey="value"
                    labelLine={false}
                    label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={40}
                    iconType="circle"
                    wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {user?.role !== 'Viewer' && (
              <div className="mt-8 pt-8 border-t border-slate-100 text-center">
                <a href="/upload" className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
                  Process New File <ArrowUpRight size={18} />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeJobData && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 animate-in slide-in-from-bottom-4 duration-300 z-50">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-bold text-slate-800 text-sm">Processing Upload</h4>
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          </div>

          <div className="mb-3">
            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
              <span>{activeJobData.fileName}</span>
              <span className="text-blue-600">{activeJobData.processed} records</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 animate-pulse"
                style={{ width: '70%' }}
              ></div>
            </div>
          </div>

          {activeJobData.latestRecord && (
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current</p>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700 truncate mr-2">{activeJobData.latestRecord.transactionId}</span>
                <span className="text-blue-700 font-bold whitespace-nowrap">₹{activeJobData.latestRecord.amount.toLocaleString()}</span>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-4 text-center font-medium">Updating dashboard in real-time...</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color, trend, subText, isAccuracy }) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-2xl ${color}`}>
          {icon}
        </div>
        <span className="text-slate-500 font-bold text-sm">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900">{value?.toLocaleString()}</span>
        {isAccuracy && (
          <span className="text-emerald-500 text-sm font-bold flex items-center gap-1">
            <TrendingUp size={14} /> High
          </span>
        )}
      </div>
      <p className="text-slate-400 text-xs font-medium mt-1 uppercase tracking-wider">
        {subText || 'Lifetime statistics'}
      </p>
    </div>
  );
}
