import axios from 'axios';
import type { PortMode, MeterModel, ServiceNode } from '../types';

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
    deviceMode: '/api/v1/device/mode/',
    installationPlace: '/api/v1/installation_place/',
    objectType: '/api/v1/object_type/',
    address: '/api/v1/address/',
};

export const getPortModes = async (deviceModelId?: number): Promise<PortMode[]> => {
    const url = deviceModelId 
        ? `${endpoints.deviceMode}?device_model=${deviceModelId}&page_size=100`
        : `${endpoints.deviceMode}?page_size=100`;
    const res = await api.get(url);
    return res.data.results;
};

export const getMeterModels = async (): Promise<MeterModel[]> => {
    const res = await api.get(`${endpoints.meterModels}?page_size=300`);
    return res.data.results;
};

export const getInstallationPlaces = async (): Promise<any[]> => {
    const res = await api.get(`${endpoints.installationPlace}?page_size=200`);
    return res.data.results;
};

export const getObjectTypes = async (): Promise<any[]> => {
    const res = await api.get(`${endpoints.objectType}?page_size=300`);
    return res.data.results;
};

// Walk the node tree (one recursive call) and collect IoT-Exponenta service
// companies (type 17) with their city/supplier context, for the region picker.
export const getServiceNodes = async (): Promise<ServiceNode[]> => {
    const res = await api.get('/api/v1/node/', { params: { parent: 'none', page_size: 500 } });
    const roots = Array.isArray(res.data?.results)
        ? res.data.results
        : (Array.isArray(res.data) ? res.data : []);
    const out: ServiceNode[] = [];
    const walk = (n: any, city: string, supplier: string) => {
        let c = city;
        let s = supplier;
        // type 3=область, 4=район, 5=город — keep the most specific seen on the way down
        if (n.type === 3 || n.type === 4 || n.type === 5) c = n.name || c;
        if (n.type === 16) s = n.name || s; // supplier (водоканал / тепловые сети)
        if (n.type === 17 && /IoT-?Exponenta/i.test(n.name || '')) {
            out.push({ id: n.id, name: n.name, supplier: s, city: c });
        }
        for (const ch of (n.children || [])) walk(ch, c, s);
    };
    for (const r of roots) walk(r, '', '');
    return out;
};

// Single node detail — used on selection to read `additional_fields`
// (inherited down the tree from the supplier).
export const getNodeDetail = async (id: number): Promise<any> => {
    const res = await api.get(`/api/v1/node/${id}/`);
    return res.data;
};

export default api;
