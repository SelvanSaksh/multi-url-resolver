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
import api, { sendScanData } from './api';

// Function to send logs to server for PM2 monitoring
const sendServerLog = async (logData) => {
    try {
        await api.post('https://tandt.api.sakksh.com/genbarcode/log', {
            timestamp: new Date().toISOString(),
            type: 'redirection',
            data: logData
        });
    } catch (error) {
        console.error('Failed to send server log:', error);
    }
};

// Import all images from the assets/images folder
import GenerateImage from './assets/images/Generate.png';
import HistoryImage from './assets/images/History.png';
import PackingImage from './assets/images/Packing.png';
import PickingImage from './assets/images/Picking.png';
import ScaningImage from './assets/images/Scaning.png';

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
    const [location, setLocation] = useState({ lat: null, lng: null });
    const [deviceType, setDeviceType] = useState("Unknown");
    const [error, setError] = useState(null);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [locationRequired, setLocationRequired] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [locationDataReady, setLocationDataReady] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || navigator.vendor || window.opera;

    if (/android/i.test(ua)) {
      setDeviceType("Android");
    } else if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) {
      setDeviceType("iOS (iPhone/iPad)");
    } else if (/Macintosh|Windows|Linux/.test(ua)) {
      setDeviceType("Laptop/Desktop");
    } else {
      setDeviceType("Unknown Device");
    }
    
  }, []);



     useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          console.log("Location fetched:", position.coords);
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError(err.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,          
          maximumAge: 0,          
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
    }
  }, []);
   
    useEffect(() => {
        if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
            setShowWarning(true);
            setSessionExpired(true);
            return;
        }
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
        const checkAndFetchLocation = async () => {
            try {
                const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                const data = response.data;

                const hasLocationType = Array.isArray(data?.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Location');
                
                if (hasLocationType) {
                    setLocationRequired(true);
                    console.log('📍 Location-based routing detected in data');
                }
                
                if (hasLocationType && (!currentLocation || !userLatLng)) {
                    if (navigator.geolocation) {
                        // Check location permission first
                        if (navigator.permissions) {
                            navigator.permissions.query({name: 'geolocation'}).then(function(result) {
                                console.log('📍 Location permission status:', result.state);
                                if (result.state === 'denied') {
                                    console.log('❌ Location permission denied');
                                    setShowLocationPrompt(true);
                                    setError('Location access is required for location-based routing but permission was denied.');
                                    return;
                                }
                            });
                        }
                        
                        navigator.geolocation.getCurrentPosition(
                            async (position) => {
                                console.log('✅ Location access granted');
                                setShowLocationPrompt(false);
                                const { latitude, longitude } = position.coords;
                                setUserLatLng({ lat: latitude, lng: longitude });

                                if (!currentLocation) {
                                    try {
                                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                                        const locData = await res.json();
                                        console.log('🗺️ Full location data from OpenStreetMap API:', locData);
                                        
                                        const detectedCity = locData.address.city || 
                                                            locData.address.town || 
                                                            locData.address.village || 
                                                            locData.address.state_district || 
                                                            locData.address.state || 
                                                            '';
                                        
                                        setCurrentLocation(detectedCity);
                                        console.log('🏙️ Detected City/Location from Street Map API:', detectedCity);
                                        console.log('📋 Address breakdown:', {
                                            city: locData.address.city,
                                            town: locData.address.town,
                                            village: locData.address.village,
                                            state_district: locData.address.state_district,
                                            state: locData.address.state,
                                            country: locData.address.country
                                        });
                                        setLocationDataReady(true);
                                        console.log('✅ Location data ready for redirection logic');
                                    } catch (err) {
                                        setCurrentLocation(`${latitude},${longitude}`);
                                        console.log('⚠️ Error getting location name, using coordinates:', `${latitude},${longitude}`);
                                        setLocationDataReady(true);
                                    }
                                }

                                // Ensure all required data is available before making the API call
                                if (data?.jsonData?.barcodeDetails && data?.jsonData?.barcodeDetails?.id) {
                                    const payload = {
                                        barcode_id: data.jsonData.barcodeDetails.id,
                                        barcode_details: data.jsonData.barcodeDetails,
                                        latitude: latitude || null,
                                        longitude: longitude || null,
                                    };

                                    const scanUrl = 'https://tandt.api.sakksh.com/genbarcode/scan';
                                    try {
                                        const scanResponse = await api.post(scanUrl, payload);
                                        console.log('Scan details sent successfully:', scanResponse.data);
                                    } catch (error) {
                                        console.error('Failed to send scan details:', error);
                                    }
                                } else {
                                    console.warn('Required data is missing. Skipping API call.');
                                }
                            },
                            async (error) => {
                                console.error('🚫 Geolocation error:', error);
                                console.log('📍 Location required but access failed');
                                
                                // Show location prompt for permission-related errors
                                if (error.code === error.PERMISSION_DENIED) {
                                    setShowLocationPrompt(true);
                                    setError('Location access is required for location-based routing. Please enable location access and try again.');
                                } else if (error.code === error.POSITION_UNAVAILABLE) {
                                    setShowLocationPrompt(true);
                                    setError('Unable to determine your location. Please check your location settings.');
                                } else if (error.code === error.TIMEOUT) {
                                    setShowLocationPrompt(true);
                                    setError('Location request timed out. Please try again.');
                                } else {
                                    setShowLocationPrompt(true);
                                    setError('Location access failed. Location-based routing requires your location.');
                                }
                                
                                // Set location data as ready even if failed, so redirection can proceed with defaults
                                setLocationDataReady(true);
                                
                                try {
                                    const { logErrorToTetr } = await import('./api');
                                    logErrorToTetr(error, { source: 'geolocation', id });
                                } catch (e) {}
                            },
                            {
                                enableHighAccuracy: true,
                                timeout: 15000,
                                maximumAge: 60000
                            }
                        );
                    }
                } else {
                    // No location required, set ready state immediately
                    console.log('📍 No location-based routing required');
                    setLocationDataReady(true);
                    
                    if (data?.jsonData?.barcodeDetails && data?.jsonData?.barcodeDetails?.id) {
                        const payload = {
                            barcode_id: data.jsonData.barcodeDetails.id,
                            barcode_details: data.jsonData.barcodeDetails,
                            latitude: null,
                            longitude: null,
                        };

                        const scanUrl = 'https://tandt.api.sakksh.com/genbarcode/scan';
                        try {
                            const scanResponse = await api.post(scanUrl, payload);
                            console.log('Scan details sent successfully:', scanResponse.data);
                        } catch (error) {
                            console.error('Failed to send scan details:', error);
                        }
                    } else {
                        console.warn('Required data is missing. Skipping API call.');
                    }
                }
            } catch (error) {
                console.error('Error fetching barcode details:', error);
            }
        };
        checkAndFetchLocation();
    }, []);

    const [mobile, setMobile] = useState(true);
    const [urlData, setUrlData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [displayUrl, setDisplayUrl] = useState('');
    const [displayTitle, setDisplayTitle] = useState('');

    const [userLatLng, setUserLatLng] = useState(null);
    
    const requestLocationPermission = () => {
        console.log('🔄 Requesting location permission...');
        setShowLocationPrompt(false);
        setError(null);
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    console.log('✅ Location permission granted');
                    const { latitude, longitude } = position.coords;
                    setUserLatLng({ lat: latitude, lng: longitude });
                    setLocation({ lat: latitude, lng: longitude });
                    
                    // Get city name from coordinates
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
                        const locData = await res.json();
                        const detectedCity = locData.address.city || 
                                            locData.address.town || 
                                            locData.address.village || 
                                            locData.address.state_district || 
                                            locData.address.state || '';
                        setCurrentLocation(detectedCity);
                        console.log('🏙️ Location detected:', detectedCity);
                    } catch (err) {
                        setCurrentLocation(`${latitude},${longitude}`);
                    }
                },
                (error) => {
                    console.error('🚫 Location permission denied again:', error);
                    setShowLocationPrompt(true);
                    if (error.code === error.PERMISSION_DENIED) {
                        setError('Location access is required for location-based routing. Please enable location in your browser settings.');
                    } else {
                        setError('Unable to access location. Please check your location settings and try again.');
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 60000
                }
            );
        } else {
            setError('Geolocation is not supported by this browser.');
        }
    };
    
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
                console.log('🔍 Checking location match for:', {
                    'Street Map API Location': currentLocation,
                    'Response Data City': details.city,
                    'Response Data State': details.state,
                    'Response Data Country': details.country,
                    'Full Item Details': details
                });
                
                const clean = str => str ? str.replace(/[^\p{L}\p{N} ]+/gu, '').trim().toLowerCase() : '';
                const currentLocClean = clean(currentLocation);
                const responseCity = clean(details.city);
                const responseState = clean(details.state);
                const responseCountry = clean(details.country);
                const responseStateDistrict = clean(details.state_district);
                
                console.log('🧹 Cleaned strings for comparison:', {
                    'Street Map Location (cleaned)': currentLocClean,
                    'Response City (cleaned)': responseCity,
                    'Response State (cleaned)': responseState,
                    'Response Country (cleaned)': responseCountry,
                    'Response State District (cleaned)': responseStateDistrict
                });
                
                let cityMatch = responseCity && (
                    currentLocClean.includes(responseCity) || 
                    responseCity.includes(currentLocClean) ||
                    currentLocClean === responseCity
                );
                
                if (!cityMatch && responseCity && currentLocClean) {
                    const commonVariations = [
                        ['bengaluru', 'bangalore'],
                        ['mumbai', 'bombay'],
                        ['kolkata', 'calcutta'],
                        ['chennai', 'madras'],
                        ['pune', 'poona'],
                        ['kochi', 'cochin']
                    ];
                    
                    for (const [name1, name2] of commonVariations) {
                        if ((responseCity === name1 && currentLocClean === name2) ||
                            (responseCity === name2 && currentLocClean === name1)) {
                            cityMatch = true;
                            console.log('🔄 Found city variation match:', currentLocClean, '↔', responseCity);
                            break;
                        }
                    }
                }
                
                console.log('🎯 Location matching results:', {
                    'Raw Street Map Location': currentLocation,
                    'Raw Response City': details.city,
                    'Cleaned Street Map': currentLocClean,
                    'Cleaned Response City': responseCity,
                    cityMatch,
                    'Direct includes check': currentLocClean.includes(responseCity),
                    'Reverse includes check': responseCity.includes(currentLocClean),
                    'Exact match check': currentLocClean === responseCity
                });
                
                if (cityMatch && details.url) {
                    console.log('✅ CITY MATCH FOUND! URL:', details.url);
                    console.log('📍 Matched:', {
                        'Street Map Location': currentLocation,
                        'Response City': details.city
                    });
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
        if (!id) return;
        
        const fetchUrlData = async () => {
            try {
                // Call the barcode API
                const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                const data = response.data;
                setUrlData(data);
                console.log(data, "Data");
                
                // Device detection
                const userAgent = navigator.userAgent || navigator.vendor || window.opera;
                let deviceType = '';
                if (/android/i.test(userAgent)) {
                    deviceType = 'Android';
                } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                    deviceType = 'iPhone';
                }
                console.log('Detected deviceType:', deviceType);

                // Device-based redirect
                let redirectUrl = '';
                if (data.jsonData && Array.isArray(data.jsonData.data)) {
                    const deviceObj = data.jsonData.data.find(
                        item => item.type === 'Device' && item.details && item.details.deviceType === deviceType
                    );
                    if (deviceObj && deviceObj.details && deviceObj.details.url) {
                        redirectUrl = deviceObj.details.url;
                    }
                }
                if (!redirectUrl) {
                    redirectUrl = data.jsonData?.defaultURL || data.jsonData?.defaultUrl || data.defaultURL || data.defaultUrl || '';
                }
                console.log('Fetched URL data (redirect postponed):', redirectUrl);
                // Do not redirect here. Redirection will happen only after
                // the scan API (`/genbarcode/scan`) returns a response.
                // Keep `loading` true so the asset image stays visible until
                // the scan flow completes.
            } catch (error) {
                console.error('Error fetching URL data:', error);
                setLoading(false);
            }
        };
        fetchUrlData();
    }, [id, sessionExpired]);

    const [loadingImage, setLoadingImage] = useState(null);
    
    // Timeout to ensure redirection doesn't hang indefinitely waiting for location
    useEffect(() => {
        if (locationRequired && !locationDataReady) {
            const timeout = setTimeout(() => {
                console.log('⏰ Location data timeout - proceeding without location');
                setLocationDataReady(true);
            }, 10000); // 10 second timeout
            
            return () => clearTimeout(timeout);
        }
    }, [locationRequired, locationDataReady]);

    useEffect(() => {
        const images = [
            GenerateImage,
            HistoryImage,
            PackingImage,
            PickingImage,
            ScaningImage
        ];
        const randomImage = images[Math.floor(Math.random() * images.length)];
        setLoadingImage(randomImage);
    }, []);

    useEffect(() => {
        const fetchAndSendBarcodeDetails = async () => {
            // Check if we have location-based routing requirements
            const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
            const data = response.data;
            const hasLocationRouting = Array.isArray(data?.jsonData?.data) && 
                                     data.jsonData.data.some(item => item.type === 'Location');
            
            // If location routing is required but location data is not ready, wait
            if (hasLocationRouting && !locationDataReady) {
                console.log('🔄 Location routing required but location data not ready yet. Waiting...');
                return;
            }
            
            console.log('✅ All required data ready. Proceeding with redirection logic...');
            
            try {
                const barcodeDetails = data?.jsonData?.data || {};

                const payload = {
                    barcodeDetails:{...barcodeDetails,...{barcodeImageUrl:data?.barcodeImageUrl,defaultURL:data?.defaultURL}},
                    barcodeId:data?.id,
                    userLatLng,
                    latitude: location?.lat ?? null,
                    longitude: location?.lng ?? null,
                    deviceType:deviceType
                };

                console.log('Prepared payload (will send scan):', payload);

                setLoading(true);

                const scanUrl = 'https://tandt.api.sakksh.com/genbarcode/scan';
                const scanResponse = await api.post(scanUrl, payload);

                console.log('Scan details sent successfully:', scanResponse.data);

                // Device detection for redirect
                const userAgent = navigator.userAgent || navigator.vendor || window.opera;
                let detectedDeviceType = '';
                if (/android/i.test(userAgent)) {
                    detectedDeviceType = 'Android';
                } else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
                    detectedDeviceType = 'iPhone';
                }
                console.log('Detected deviceType for redirect:', detectedDeviceType);

                // First, try device-based redirect URL selection
                let redirectUrl = '';
                if (data.jsonData && Array.isArray(data.jsonData.data)) {
                    const deviceObj = data.jsonData.data.find(
                        item => item.type === 'Device' && item.details && item.details.deviceType === detectedDeviceType
                    );
                    if (deviceObj && deviceObj.details && deviceObj.details.url) {
                        redirectUrl = deviceObj.details.url;
                        console.log('Found device-specific URL for', detectedDeviceType + ':', redirectUrl);
                    }
                }
                
                if (!redirectUrl) {
                    console.log('No device-specific URL found. Trying dynamic routing with:', {
                        currentLocation,
                        userLatLng,
                        dataArray: data.jsonData?.data
                    });
                    const dynamicResult = findMatchingUrlAndTitle(data.jsonData, currentLocation, userLatLng);
                    redirectUrl = dynamicResult.url;
                    console.log('Dynamic routing result:', dynamicResult);
                }
                
                if (!redirectUrl) {
                    redirectUrl = data.jsonData?.defaultURL || data.jsonData?.defaultUrl || data.defaultURL || data.defaultUrl || '';
                    console.log('Using default URL:', redirectUrl);
                }
                
                if (redirectUrl) {
                    const finalUrl = redirectUrl.startsWith('http') ? redirectUrl : `https://${redirectUrl}`;
                    const logData = {
                        id: id,
                        finalUrl: finalUrl,
                        streetMapLocation: currentLocation,
                        matchedCity: data.jsonData?.data?.find(item => 
                            item.type === 'Location' && item.details?.url === redirectUrl.replace('https://', '').replace('http://', '')
                        )?.details?.city || 'Unknown',
                        deviceType: detectedDeviceType,
                        userCoordinates: userLatLng,
                        source: 'redirection_success'
                    };
                    
                    console.log('🎯 REDIRECTION URL MATCHED!');
                    console.log('📍 Final redirect URL:', finalUrl);
                    console.log('🔍 URL Source: Device-specific or Dynamic routing');
                    console.log('📊 Street Map Location (detected):', currentLocation);
                    console.log('🏙️ Matched Location Data:', {
                        'Street Map API Result': currentLocation,
                        'Matched City from Response': logData.matchedCity,
                        'Final URL': finalUrl
                    });
                    console.log('📱 Device Type:', detectedDeviceType);
                    console.log('🌍 User Coordinates:', userLatLng);
                    
                    // Send log to server for PM2 monitoring
                    sendServerLog(logData);
                    
                    // Perform the actual redirection
                    window.location.replace(finalUrl);
                    return;
                }

                // No redirect URL: reveal details to user
                const noMatchLogData = {
                    id: id,
                    currentLocation: currentLocation,
                    deviceType: detectedDeviceType,
                    userCoordinates: userLatLng,
                    availableData: data.jsonData?.data,
                    source: 'no_redirection_match'
                };
                
                console.log('❌ NO REDIRECTION URL MATCHED');
                console.log('📍 Current Location:', currentLocation);
                console.log('📱 Device Type:', detectedDeviceType);
                console.log('🌍 User Coordinates:', userLatLng);
                console.log('📋 Available data:', data.jsonData?.data);
                
                // Send log to server for PM2 monitoring
                sendServerLog(noMatchLogData);
                
                setShowDetails(true);
            } catch (error) {
                console.error('Failed to send barcode details or redirect:', error);
                // reveal page so user can see message / retry
                setShowDetails(true);
                alert('Error: ' + (error?.message || 'Something went wrong. Please try again.'));
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchAndSendBarcodeDetails();
        }
    }, [id, userLatLng, currentLocation, deviceType, locationDataReady]);

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
    
    // Show location permission prompt if location is required but not available
    if (showLocationPrompt && locationRequired) {
        return (
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📍</div>
                    <h2 style={{ color: '#1976d2', marginBottom: '1rem' }}>Location Access Required</h2>
                    <p style={{ color: '#666', marginBottom: '1rem', lineHeight: '1.5' }}>
                        This QR code uses location-based routing to show you the most relevant content for your area.
                    </p>
                    {error && (
                        <div style={{ 
                            background: '#ffe6e6', 
                            color: '#d63031', 
                            padding: '0.75rem', 
                            borderRadius: '8px', 
                            marginBottom: '1rem',
                            fontSize: '14px'
                        }}>
                            {error}
                        </div>
                    )}
                    <p style={{ color: '#666', fontSize: '14px', marginBottom: '2rem' }}>
                        Please allow location access to continue, or the default content will be shown.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button 
                        style={{ 
                            padding: '0.75rem 1.5rem', 
                            background: '#1976d2', 
                            color: '#fff', 
                            border: 'none', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold'
                        }} 
                        onClick={requestLocationPermission}
                    >
                        Allow Location Access
                    </button>
                    <button 
                        style={{ 
                            padding: '0.75rem 1.5rem', 
                            background: '#fff', 
                            color: '#1976d2', 
                            border: '2px solid #1976d2', 
                            borderRadius: '8px', 
                            cursor: 'pointer',
                            fontSize: '16px'
                        }} 
                        onClick={() => {
                            setShowLocationPrompt(false);
                            setShowDetails(true);
                            setLoading(false);
                        }}
                    >
                        Use Default Content
                    </button>
                </div>
            </div>
        );
    }
    
    if (loading || !showDetails) {
        return (
            <div style={mobile ? mobileStyles.loadingContainer : desktopStyles.loadingContainer}>
                {loadingImage && <img src={loadingImage} alt="Loading" style={{ maxWidth: '100%', height: 'auto' }} />}
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