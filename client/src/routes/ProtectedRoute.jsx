import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

export default function ProtectedRoute({ children, roles }) {
  const user = useAuthStore(state => state.user);

  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;

  return children;
}
