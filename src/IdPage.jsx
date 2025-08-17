import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import barcodeIcon from './assets/barcode.svg';
import api from './api';
// import { useParams, useSearchParams } from 'react-router-dom';

const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const IdPage = () => {
    const { id } = useParams();
    const queryString = window.location.search;
    const queryParams = new URLSearchParams(queryString);
    const currentLocation = queryParams.get('curlocation');
    console.log('Current Location:', currentLocation);

    const [mobile, setMobile] = useState(true);
    const [urlData, setUrlData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [displayUrl, setDisplayUrl] = useState('');

    // Function to get current time in HH:MM format
    const getCurrentTime = () => {
        const now = new Date();
        return now.toTimeString().slice(0, 5); // Format: HH:MM
    };

    // Function to check if current time is between start and end time
    const isTimeInRange = (startTime, endTime) => {
        const currentTime = getCurrentTime();
        
        // Convert times to minutes for easier comparison
        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        // Handle cases where end time is next day
        if (endMinutes < startMinutes) {
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
        
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    };

    // Function to find matching URL based on conditions
    const findMatchingUrl = (jsonData, currentLocation) => {
        if (!jsonData?.data || !Array.isArray(jsonData.data)) {
            return jsonData?.defaultURL || '';
        }

        // Check each data item for matches
        for (const item of jsonData.data) {
            if (item.type === 'Location' && currentLocation) {
                const details = item.details;
                // Check if current location matches any location field
                const locationMatch = 
                    currentLocation.toLowerCase() === details.city?.toLowerCase() ||
                    currentLocation.toLowerCase() === details.state?.toLowerCase() ||
                    currentLocation.toLowerCase() === details.country?.toLowerCase() ||
                    currentLocation.toLowerCase().includes(details.city?.toLowerCase()) ||
                    currentLocation.toLowerCase().includes(details.state?.toLowerCase());
                
                if (locationMatch && details.url) {
                    return details.url;
                }
            }
            
            if (item.type === 'Time') {
                const details = item.details;
                if (details.startTime && details.endTime) {
                    if (isTimeInRange(details.startTime, details.endTime)) {
                        return details.url || jsonData?.defaultURL || '';
                    }
                }
            }
        }

        // Return default URL if no matches found
        return jsonData?.defaultURL || '';
    };

    useEffect(() => {
        setMobile(isMobile());
        const fetchUrlData = async () => {
            try {
                // Call the barcode API
                const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                const data = response.data;
                setUrlData(data);
                
                // Determine which URL to display
                const matchedUrl = findMatchingUrl(data.jsonData, currentLocation);
                setDisplayUrl(matchedUrl);
                
                setLoading(false);
            } catch (error) {
                console.error('Error fetching URL data:', error);
                setLoading(false);
            }
        };
        fetchUrlData();
    }, [id, currentLocation]);

    if (loading) {
        return (
            <div style={mobile ? mobileStyles.loadingContainer : desktopStyles.loadingContainer}>
                <div style={mobile ? mobileStyles.spinner : desktopStyles.spinner}></div>
                <p style={{ color: '#1976d2', marginTop: '16px' }}>Loading URL information...</p>
            </div>
        );
    }

    if (!urlData) {
        return (
            <div style={mobile ? mobileStyles.errorContainer : desktopStyles.errorContainer}>
                <h2 style={{ color: '#1976d2' }}>URL Not Found</h2>
                <p>The requested URL with ID "{id}" could not be found.</p>
            </div>
        );
    }

    if (mobile) {
        return (
            <div style={mobileStyles.container}>
                <header style={mobileStyles.header}>
                    <img src={barcodeIcon} alt="barcode scanner" style={mobileStyles.icon} />
                    qr.sakksh.com
                </header>

                <div style={mobileStyles.content}>
                    <h2 style={mobileStyles.title}>Scanned Information</h2>

                    {currentLocation && (
                        <div style={{ color: '#1976d2', fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                            Current Location: {currentLocation}
                        </div>
                    )}

                    {/* Display the matched URL */}
                    {displayUrl && (
                        <div style={mobileStyles.card}>
                            <div style={mobileStyles.cardHeader}>URL</div>
                            <div style={mobileStyles.cardContent}>
                                <a href={displayUrl.startsWith('http') ? displayUrl : `https://${displayUrl}`} 
                                   target="_blank" 
                                   rel="noopener noreferrer" 
                                   style={mobileStyles.link}>
                                    {displayUrl}
                                </a>
                            </div>
                        </div>
                    )}

                    <div style={mobileStyles.statsContainer}>
                        <div style={mobileStyles.statItem}>
                            <div style={mobileStyles.statValue}>{urlData.status || 'Active'}</div>
                            <div style={mobileStyles.statLabel}>Status</div>
                        </div>
                        <div style={mobileStyles.statItem}>
                            <div style={mobileStyles.statValue}>
                                {urlData.createdAt ? new Date(urlData.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                            </div>
                            <div style={mobileStyles.statLabel}>Date</div>
                        </div>
                    </div>
                </div>
                
                <footer style={{
                    width: '100%',
                    textAlign: 'center',
                    color: '#1976d2',
                    fontSize: 14,
                    marginTop: 32,
                    marginBottom: 8,
                    opacity: 0.8,
                }}>
                    Powered by <a href="https://sakksh.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>sakksh.com</a>
                </footer>
            </div>
        );
    }

    return (
        <div style={desktopStyles.container}>
            <div style={desktopStyles.phoneMockup}>
                {/* iPhone notch */}
                <div style={desktopStyles.notch} />

                <header style={desktopStyles.header}>
                    <img src={barcodeIcon} alt="barcode scanner" style={desktopStyles.icon} />
                    qr.sakksh.com
                </header>

                <div style={desktopStyles.content}>
                    <h2 style={desktopStyles.title}>Scanned Information</h2>

                    {currentLocation && (
                        <div style={{ color: '#1976d2', fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                            Current Location: {currentLocation}
                        </div>
                    )}

                    {/* Display the matched URL */}
                    {displayUrl && (
                        <div style={desktopStyles.card}>
                            <div style={desktopStyles.cardHeader}>URL</div>
                            <div style={desktopStyles.cardContent}>
                                <a href={displayUrl.startsWith('http') ? displayUrl : `https://${displayUrl}`} 
                                   target="_blank" 
                                   rel="noopener noreferrer" 
                                   style={desktopStyles.link}>
                                    {displayUrl}
                                </a>
                            </div>
                        </div>
                    )}

                    <div style={desktopStyles.statsContainer}>
                        <div style={desktopStyles.statItem}>
                            <div style={desktopStyles.statValue}>{urlData.status || 'Active'}</div>
                            <div style={desktopStyles.statLabel}>Status</div>
                        </div>
                        <div style={desktopStyles.statItem}>
                            <div style={desktopStyles.statValue}>
                                {urlData.createdAt ? new Date(urlData.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
                            </div>
                            <div style={desktopStyles.statLabel}>Date</div>
                        </div>
                    </div>
                </div>
                
                <footer style={{
                    width: '100%',
                    textAlign: 'center',
                    color: '#1976d2',
                    fontSize: 14,
                    marginTop: 32,
                    marginBottom: 8,
                    opacity: 0.8,
                }}>
                    Powered by <a href="https://sakksh.com" target="_blank" rel="noopener noreferrer" style={{ color: '#1976d2', textDecoration: 'underline' }}>sakksh.com</a>
                </footer>
            </div>
        </div>
    );
};

// Mobile styles
const mobileStyles = {
    container: {
        minHeight: '100vh',
        background: '#f5f9ff',
    },
    header: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 10px',
        fontWeight: 'bold',
        fontSize: 20,
        letterSpacing: 2,
        background: '#1976d2',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.2)',
    },
    icon: {
        height: 28,
        width: 28,
    },
    content: {
        padding: 20,
    },
    title: {
        color: '#1976d2',
        textAlign: 'center',
        marginBottom: 24,
    },
    card: {
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
    },
    cardHeader: {
        color: '#1976d2',
        fontWeight: 'bold',
        marginBottom: 8,
        fontSize: 14,
    },
    cardContent: {
        color: '#333',
        wordBreak: 'break-all',
    },
    link: {
        color: '#1976d2',
        textDecoration: 'none',
    },
    statsContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statItem: {
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        width: '48%',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
    },
    statValue: {
        color: '#1976d2',
        fontWeight: 'bold',
        fontSize: 20,
    },
    statLabel: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },
    qrContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 24,
    },
    qrCode: {
        width: 150,
        height: 150,
        border: '8px solid #fff',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)',
    },
    qrText: {
        color: '#1976d2',
        marginTop: 8,
        fontWeight: 'bold',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f9ff',
    },
    spinner: {
        border: '4px solid rgba(25, 118, 210, 0.2)',
        borderTop: '4px solid #1976d2',
        borderRadius: '50%',
        width: 40,
        height: 40,
        animation: 'spin 1s linear infinite',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f9ff',
        padding: 20,
        textAlign: 'center',
    },
};

// Desktop styles
const desktopStyles = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f0f0',
    },
    phoneMockup: {
        width: '100vw',
        maxWidth: 500,
        height: '95vh',
        maxHeight: '95vh',
        border: '16px solid #222',
        borderRadius: 40,
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        background: '#f5f9ff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    notch: {
        position: 'absolute',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 120,
        height: 24,
        background: '#222',
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        marginTop: -16,
        zIndex: 2,
    },
    header: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '16px 0',
        fontWeight: 'bold',
        fontSize: 20,
        letterSpacing: 2,
        background: '#1976d2',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.2)',
    },
    icon: {
        height: 28,
        width: 28,
    },
    content: {
        padding: 20,
        flex: 1,
        overflowY: 'auto',
    },
    title: {
        color: '#1976d2',
        textAlign: 'center',
        marginBottom: 24,
    },
    card: {
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
    },
    cardHeader: {
        color: '#1976d2',
        fontWeight: 'bold',
        marginBottom: 8,
        fontSize: 14,
    },
    cardContent: {
        color: '#333',
        wordBreak: 'break-all',
    },
    link: {
        color: '#1976d2',
        textDecoration: 'none',
    },
    statsContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    statItem: {
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        width: '48%',
        textAlign: 'center',
        boxShadow: '0 2px 8px rgba(25, 118, 210, 0.1)',
    },
    statValue: {
        color: '#1976d2',
        fontWeight: 'bold',
        fontSize: 20,
    },
    statLabel: {
        color: '#666',
        fontSize: 12,
        marginTop: 4,
    },
    qrContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginTop: 24,
    },
    qrCode: {
        width: 150,
        height: 150,
        border: '8px solid #fff',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.2)',
    },
    qrText: {
        color: '#1976d2',
        marginTop: 8,
        fontWeight: 'bold',
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f9ff',
    },
    spinner: {
        border: '4px solid rgba(25, 118, 210, 0.2)',
        borderTop: '4px solid #1976d2',
        borderRadius: '50%',
        width: 40,
        height: 40,
        animation: 'spin 1s linear infinite',
    },
    errorContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f9ff',
        padding: 20,
        textAlign: 'center',
    },
};

export default IdPage;