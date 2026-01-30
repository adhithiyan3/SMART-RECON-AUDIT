import { useAuthStore } from '../store/auth.store';

export default function useAuth() {
  const user = useAuthStore(state => state.user);
  const login = useAuthStore(state => state.login);
  const logout = useAuthStore(state => state.logout);

  return {
    user,
    login,
    logout,
    isAuthenticated: !!user
  };
}
