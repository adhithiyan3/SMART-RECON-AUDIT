import { create } from 'zustand';
import axios from '../api/axios';

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  login: (token, userData) => {
    localStorage.setItem('token', token);
    set({ user: userData });
  },
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null });
  },
  checkAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ user: null, loading: false });
      return;
    }

    try {
      const res = await axios.get('/auth/me');
      set({ user: res.data, loading: false });
    } catch (error) {
      localStorage.removeItem('token');
      set({ user: null, loading: false });
    }
  }
}));
