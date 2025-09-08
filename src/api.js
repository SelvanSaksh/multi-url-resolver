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


// Simple logger for errors (send to Tetr)
export const logErrorToTetr = async (error, extra = {}) => {
  try {
    await api.post('https://tandt.api.sakksh.com/log', {
      error: typeof error === 'string' ? error : error?.message || JSON.stringify(error),
      ...extra,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    // Silently fail if logging fails
    // Optionally, console.error(e);
  }
};

// Function to send scanned data to the server
export const sendScanData = async (scannedCode, userId, userName, userRole, companyName) => {
    const url = 'https://tandt.api.sakksh.com/genbarcode/scan';

    // Get the user's location (latitude and longitude)
    const latitude = 0.0; // Replace with actual latitude if available
    const longitude = 0.0; // Replace with actual longitude if available

    const payload = {
        deviceId: navigator.userAgent || 'unknown-device',
        latitude,
        longitude,
        barcodeDetails: data.barcodeDetails || { scannedUrl: scannedCode },
        isAuthenticated: false,
        userId: userId || '',
        userName: userName || '',
        userRole: userRole || '',
        companyName: companyName || '',
        barcodeId: scannedCode.split('/').pop() || scannedCode
    };

    try {
        const response = await api.post(url, payload);
        return response.data;
    } catch (error) {
        console.error('Error sending scan data:', error);
        throw error;
    }
};

export default api;
