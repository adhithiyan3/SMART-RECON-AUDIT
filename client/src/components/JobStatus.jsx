import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function JobStatus({ jobId }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await api.get(`/jobs/${jobId}/status`);
      setStatus(res.data);
    }, 3000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (!status) return null;

  return (
    <div className="mt-4 p-4 bg-white shadow rounded">
      <p>Status: {status.status}</p>
      <p>Processed: {status.processed}</p>
      <p>Failed: {status.failed}</p>
    </div>
  );
}
