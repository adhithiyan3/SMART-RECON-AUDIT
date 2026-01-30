import api from './axios';

export const getUploadHistory = () => {
  return api.get('/upload/history');
};

export const getActiveJob = () => {
  return api.get('/upload/active');
};

export const uploadFile = (file, mapping) => {
  const formData = new FormData();
  formData.append('file', file);
  if (mapping) {
    formData.append('mapping', JSON.stringify(mapping));
  }
  return api.post('/upload', formData);
};

export const getJobStatus = (jobId) => {
  return api.get(`/upload/${jobId}`);
};

export const submitMapping = (jobId, mapping) => {
  return api.post(`/upload/${jobId}/map`, { mapping });
};

export const checkDuplicate = (fileHash) => {
  return api.post('/upload/check-duplicate', { fileHash });
};
