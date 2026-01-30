import { useState, useEffect } from 'react';
import { getConfigs, updateConfig } from '../api/config.api';
import { useAuthStore } from '../store/auth.store';
import { Save, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';

export default function Settings() {
    const { user } = useAuthStore();
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        try {
            const res = await getConfigs();
            setConfigs(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (key, value) => {
        setSaving(true);
        try {
            // If the value is a number (variance), parse it
            const val = key === 'reconciliation_variance' ? parseFloat(value) : value;
            await updateConfig(key, val);
            await fetchConfigs();
            alert('Configuration updated successfully');
        } catch (err) {
            console.error(err);
            alert('Failed to update configuration');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center">Loading settings...</div>;

    if (user?.role !== 'Admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center p-8">
                    <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
                    <h1 className="text-2xl font-black text-slate-800">Access Denied</h1>
                    <p className="text-slate-500 mt-2">Only Administrators can modify system settings.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 lg:p-10">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                        <SettingsIcon size={24} className="text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900">System Configuration</h1>
                        <p className="text-slate-500 text-sm font-medium">Manage global matching rules and parameters.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    {configs.map(config => (
                        <div key={config.key} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 capitalize">
                                        {config.key.replace(/_/g, ' ')}
                                    </h3>
                                    <p className="text-slate-400 text-sm mt-1">{config.description || 'No description provided.'}</p>
                                </div>

                                <div className="flex items-center gap-3">
                                    {typeof config.value === 'number' || !Array.isArray(config.value) ? (
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                defaultValue={config.value}
                                                onBlur={(e) => {
                                                    if (parseFloat(e.target.value) !== config.value) {
                                                        handleUpdate(config.key, e.target.value);
                                                    }
                                                }}
                                                className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 font-bold text-slate-700 w-32 text-right focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <div className="absolute right-0 top-full mt-1 text-xs text-slate-400">
                                                Click away to save
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm font-mono bg-slate-100 px-3 py-1 rounded text-slate-500">
                                            {JSON.stringify(config.value)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {configs.length === 0 && (
                        <div className="text-center py-10 text-slate-400">
                            No configurations found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
