    // Helper: calculate distance between two lat/lng in meters
    function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        function deg2rad(deg) {
            return deg * (Math.PI/180);
        }
        const R = 6371000; // Radius of the earth in meters
        const dLat = deg2rad(lat2-lat1);
        const dLon = deg2rad(lon2-lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2)
            ;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const d = R * c; // Distance in meters
        return d;
    }
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
    // Session expired and warning state
    const [sessionExpired, setSessionExpired] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const { id } = useParams();
    const queryString = window.location.search;
    const queryParams = new URLSearchParams(queryString);
    const [currentLocation, setCurrentLocation] = useState(queryParams.get('curlocation') || '');
   
    useEffect(() => {
        // Detect refresh using Navigation Timing API (modern browsers)
        if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
            setShowWarning(true);
            setSessionExpired(true);
            return;
        }
        // Fallback for older browsers
        if (window.performance && window.performance.navigation && window.performance.navigation.type === 1) {
            setShowWarning(true);
            setSessionExpired(true);
            return;
        }
        // Session flag
        if (!sessionStorage.getItem('visited')) {
            sessionStorage.setItem('visited', 'true');
        } else {
            setShowWarning(true);
            setSessionExpired(true);
            return;
        }
        if (!currentLocation || !userLatLng) {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLatLng({ lat: latitude, lng: longitude });
                    if (!currentLocation) {
                        try {
                            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                            const data = await res.json();
                            const locationName = data.address.state_district || data.address.state || '';
                            setCurrentLocation(locationName);
                            console.log('Detected Location:', locationName);
                        } catch (err) {
                            setCurrentLocation(`${latitude},${longitude}`);
                            console.log('Detected Location:', `${latitude},${longitude}`);
                        }
                    }
                });
            }
        }
    }, []);

    const [mobile, setMobile] = useState(true);
    const [urlData, setUrlData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [displayUrl, setDisplayUrl] = useState('');
    const [displayTitle, setDisplayTitle] = useState('');

    const [userLatLng, setUserLatLng] = useState(null);
    const getCurrentTime = () => {
        const now = new Date();
        return now.toTimeString().slice(0, 5);
    };

    const isTimeInRange = (startTime, endTime) => {
        const currentTime = getCurrentTime();
        
        const timeToMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };

        const currentMinutes = timeToMinutes(currentTime);
        const startMinutes = timeToMinutes(startTime);
        const endMinutes = timeToMinutes(endTime);

        if (endMinutes < startMinutes) {
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
        
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    };

    const findMatchingUrlAndTitle = (jsonData, currentLocation, userLatLng, count) => {
        // Support both dynamicData and data arrays
        const dynamicArr = Array.isArray(jsonData?.dynamicData)
            ? jsonData.dynamicData
            : Array.isArray(jsonData?.data)
                ? jsonData.data
                : [];

        if (!dynamicArr.length) {
            return {
                url: jsonData?.defaultUrl || jsonData?.defaultURL || '',
                title: jsonData?.title || '',
            };
        }

        for (const item of dynamicArr) {
            // Support both item.data and item.details
            const details = item.data || item.details || {};
            if (item.type === 'Number of scans' && typeof count === 'number') {
                const scanLimit = parseInt(details.scanNumber, 10);
                if (!isNaN(scanLimit)) {
                    if (count <= scanLimit) {
                        return {
                            url: details.url,
                            title: item.title || jsonData?.title || '',
                        };
                    } else {
                        return {
                            url: jsonData?.defaultUrl || jsonData?.defaultURL || '',
                            title: jsonData?.title || '',
                        };
                    }
                }
            }
            if (item.type === 'Location' && currentLocation) {
                // Helper to remove emoji and extra spaces
                const clean = str => str ? str.replace(/[^\p{L}\p{N} ]+/gu, '').trim().toLowerCase() : '';
                const currentLocClean = clean(currentLocation);
                const cityClean = clean(details.city);
                const stateClean = clean(details.state);
                const countryClean = clean(details.country);
                const stateDistrictClean = clean(details.state_district);
                const locationMatch =
                    (cityClean && currentLocClean.includes(cityClean)) ||
                    (stateClean && currentLocClean.includes(stateClean)) ||
                    (countryClean && currentLocClean.includes(countryClean)) ||
                    (stateDistrictClean && currentLocClean.includes(stateDistrictClean));
                if (locationMatch && details.url) {
                    return {
                        url: details.url,
                        title: item.title || jsonData?.title || '',
                    };
                }
            }
            if (item.type === 'Time') {
                if (details.startTime && details.endTime) {
                    if (isTimeInRange(details.startTime, details.endTime)) {
                        return {
                            url: details.url || jsonData?.defaultUrl || jsonData?.defaultURL || '',
                            title: item.title || jsonData?.title || '',
                        };
                    }
                }
            }
            if (item.type === 'Geo-fencing' && userLatLng) {
                const apiLat = parseFloat(details.latitude);
                const apiLng = parseFloat(details.longitude);
                const radius = parseFloat(details.radius);
                const url = details.url;
                const userLat = userLatLng.lat;
                const userLng = userLatLng.lng;
                if (!isNaN(apiLat) && !isNaN(apiLng) && !isNaN(radius) && userLat && userLng) {
                    const distance = getDistanceFromLatLonInMeters(userLat, userLng, apiLat, apiLng);
                    if (distance <= radius) {
                        return {
                            url: url,
                            title: item.title || jsonData?.title || '',
                        };
                    }
                }
            }
        }
        return {
            url: jsonData?.defaultUrl || jsonData?.defaultURL || '',
            title: jsonData?.title || '',
        };
    };

    useEffect(() => {
        setMobile(isMobile());
        if (sessionExpired) return;
        if (!id || !currentLocation || !userLatLng) return;
        const fetchUrlData = async () => {
            try {
                // Call the barcode API
                const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                const data = response.data;
                setUrlData(data);
                console.log(data,"Data");
                
                // Determine which URL and title to display
                if (data.jsonData) {
                    const match = findMatchingUrlAndTitle(data.jsonData, currentLocation, userLatLng, data.count);
                    if (match.url) {
                        const finalUrl = match.url.startsWith('http') ? match.url : `https://${match.url}`;
                        window.location.replace(finalUrl);
                        return;
                    }
                    setDisplayUrl('');
                    setDisplayTitle('');
                } else {
                    setDisplayUrl('');
                    setDisplayTitle('');
                }
                setLoading(false);
            } catch (error) {
                console.error('Error fetching URL data:', error);
                setLoading(false);
            }
        };
        fetchUrlData();
    }, [id, currentLocation, userLatLng, sessionExpired]);

    if (sessionExpired) {
        return (
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
                {showWarning && <div style={{ color: 'red', marginBottom: '1rem' }}>Warning: You refreshed the page.</div>}
                <h2>Session expired</h2>
                <button style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }} onClick={() => window.location.href = '/'}>
                    Create Page
                </button>
            </div>
        );
    }
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
                    qr.gs1r.ai
                </header>

                <div style={mobileStyles.content}>
                    <h2 style={mobileStyles.title}>Scanned Information</h2>

                    {currentLocation && (
                        <div style={{ color: '#1976d2', fontWeight: 'bold', marginBottom: 16, textAlign: 'center' }}>
                            Current Location: {currentLocation}
                        </div>
                    )}

                    {/* Display the matched title and URL */}
                    {displayTitle && (
                        <div style={mobileStyles.card}>
                            <div style={mobileStyles.cardHeader}>Title</div>
                            <div style={mobileStyles.cardContent}>{displayTitle}</div>
                        </div>
                    )}
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
                            <div style={mobileStyles.statValue}>{currentLocation || 'Unknown'}</div>
                            <div style={mobileStyles.statLabel}>Current Location</div>
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
                    qr.gs1r.ai
                </header>

                <div style={desktopStyles.content}>
                    <h2 style={desktopStyles.title}>Scanned Information</h2>


                    {/* Display the matched title and URL */}
                    {displayTitle && (
                        <div style={desktopStyles.card}>
                            <div style={desktopStyles.cardHeader}>Title</div>
                            <div style={desktopStyles.cardContent}>{displayTitle}</div>
                        </div>
                    )}
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
                            <div style={desktopStyles.statValue}>{currentLocation || 'Unknown'}</div>
                            <div style={desktopStyles.statLabel}>Current Location</div>
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