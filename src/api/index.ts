import axios from 'axios';

const API_URL = 'https://sm.iot-exp.kz';

const api = axios.create({
    baseURL: API_URL,
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
    installation: '/api/v1/installation/', // Assuming this is the correct endpoint for the combined payload
    // If the above doesn't work, we might need these:
    device: '/api/v1/device/',
    meter: '/api/v1/meter/',
};

export default api;
