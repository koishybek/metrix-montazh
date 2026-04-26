import axios from 'axios';
import type { PortMode, MeterModel } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sm.iot-exp.kz';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers['Authorization'] = `Token ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const endpoints = {
    auth: '/api-token-auth/',
    meterModels: '/api/v1/meter/model/',
    device: '/api/v1/device/',
    meter: '/api/v1/meter/',
    portMode: '/api/v1/port_mode/',
};

export const getPortModes = async (): Promise<PortMode[]> => {
    const res = await api.get(`${endpoints.portMode}?page_size=100`);
    return res.data.results;
};

export const getMeterModels = async (): Promise<MeterModel[]> => {
    const res = await api.get(`${endpoints.meterModels}?page_size=100`);
    return res.data.results;
};

export default api;
