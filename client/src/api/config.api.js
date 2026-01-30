import api from './axios';

export const getConfigs = () => api.get('/config');
export const updateConfig = (key, value) => api.post('/config', { key, value });
