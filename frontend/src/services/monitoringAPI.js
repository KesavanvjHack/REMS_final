import axios from '../api/axios';

const monitoringAPI = {
    checkShift: (employeeId) => {
        const url = employeeId ? `/monitor/shift/check/${employeeId}/` : '/monitor/shift/check/';
        return axios.get(url);
    },
    startSession: () => {
        return axios.post('/monitor/monitoring/start/');
    },
    stopSession: () => {
        return axios.post('/monitor/monitoring/stop/');
    },
    getActiveEmployees: () => {
        return axios.get('/monitor/monitoring/active-employees/');
    },
    getCurrentSession: () => {
        return axios.get('/monitor/monitoring/current/');
    }
};

export default monitoringAPI;
