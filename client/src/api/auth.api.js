import api from './axios';

export const signup = (data) => api.post('/auth/signup', data);
export const signin = (data) => api.post('/auth/signin', data);
