import axios from 'axios';

const api = axios.create({
  // baseURL: 'https://your-api-url.com',
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // You can modify the request config here (e.g., add auth headers)
    // console.log('Request:', config);
    return config;
  },
  (error) => {
    // Handle request error
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // You can process the response here
    // console.log('Response:', response);
    return response;
  },
  (error) => {
    // Handle response error
    return Promise.reject(error);
  }
);

export default api;
