import api from './axios';

export const getResults = (params) => {
    return api.get('/records', { params });
};

export const correctRecord = (id, data) => {
    return api.put(`/records/${id}/correct`, data);
};

export const getTimeline = (id) => {
    return api.get(`/records/${id}/timeline`);
};
