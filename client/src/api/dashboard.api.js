import api from './axios';
export const getSummary = (params) => api.get('/dashboard/summary', { params });
export const getUsers = () => api.get('/dashboard/users');
