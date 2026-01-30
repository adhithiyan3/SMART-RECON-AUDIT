import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import ReconciliationView from './pages/ReconciliationView';
import ProtectedRoute from './routes/ProtectedRoute';
import Navbar from './components/Navbar';
import Settings from './pages/Settings';
import { useAuthStore } from './store/auth.store';

export default function App() {
  const checkAuth = useAuthStore(state => state.checkAuth);
  const loading = useAuthStore(state => state.loading);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/upload" element={
          <ProtectedRoute roles={['Admin', 'Analyst']}>
            <Upload />
          </ProtectedRoute>
        } />

        <Route path="/results" element={
          <ProtectedRoute roles={['Admin', 'Analyst', 'Viewer']}>
            <ReconciliationView />
          </ProtectedRoute>
        } />

        <Route path="/settings" element={
          <ProtectedRoute roles={['Admin']}>
            <Settings />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}
