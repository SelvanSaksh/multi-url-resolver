function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    function deg2rad(deg) {
        return deg * (Math.PI / 180);
    }
    const R = 6371000;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import barcodeIcon from './assets/barcode.svg';
import api, { sendScanData } from './api';


import GenerateImage from './assets/images/Generate.png';
import HistoryImage from './assets/images/History.png';
import PackingImage from './assets/images/Packing.png';
import PickingImage from './assets/images/Picking.png';
import ScaningImage from './assets/images/Scaning.png';


const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const IdPage = () => {
    const [sessionExpired, setSessionExpired] = useState(false);
    const [showWarning, setShowWarning] = useState(false);
    const { id } = useParams();
    const queryString = window.location.search;
    const queryParams = new URLSearchParams(queryString);
    const [currentLocation, setCurrentLocation] = useState(queryParams.get('curlocation') || '');
    const currentLocationAutoSetRef = useRef(false);
    const [location, setLocation] = useState({ lat: null, lng: null });
    const [deviceType, setDeviceType] = useState("Unknown");
    const [error, setError] = useState(null);
    const [showLocationPrompt, setShowLocationPrompt] = useState(false);
    const [locationRequired, setLocationRequired] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [locationDataReady, setLocationDataReady] = useState(false);
    const [initialDataCheckComplete, setInitialDataCheckComplete] = useState(false);
    const [ip, setIp] = useState("");
    const [locationScan, setLocationScan] = useState(false);
    const [userLatLng, setUserLatLng] = useState(null);
    const [mobile, setMobile] = useState(true);
    const [urlData, setUrlData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [displayUrl, setDisplayUrl] = useState('');
    const [displayTitle, setDisplayTitle] = useState('');
    const [loadingImage, setLoadingImage] = useState(null);


    useEffect(() => {
        if (locationRequired && !locationDataReady) {
            const timeout = setTimeout(() => {
                console.log('⏰ Location data timeout - user did not respond');
                setLocationDataReady(true);
                setError('Location permission not given. Some features may not work.');
            }, 10000); // 10 second timeout

            return () => clearTimeout(timeout);
        }
    }, [locationRequired, locationDataReady]);

    // Additional timeout for any location collection (including Time routing)
    useEffect(() => {
        if (!locationDataReady && (userLatLng || showLocationPrompt)) {
            const timeout = setTimeout(() => {
                console.log('⏰ General location data timeout - proceeding without location');
                setLocationDataReady(true);
            }, 15000); // 15 second timeout for general location collection

            return () => clearTimeout(timeout);
        }
    }, [locationDataReady, userLatLng, showLocationPrompt]);


    const fetchIP = async () => {
        try {
            const response = await fetch("https://api.ipify.org?format=json");
            const data = await response.json();
            setIp(data.ip);
            console.log('🌐 IP address fetched:', data.ip);
        } catch (err) {
            console.error("Failed to fetch IP:", err);
        }
    };
    const getLocationCoordinates = async () => {
        // Don't auto-fetch location on load - wait for user permission
        // This prevents early redirection before user can grant access
        console.log('🔄 Location coordinates will be fetched when user grants permission');
    }

    useEffect(() => {
        // Don't automatically get location on load - let it be triggered by user permission
        // getLocationCoordinates()
        
        // Fetch IP address early (this doesn't require user permission)
        fetchIP();
    }, []);

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
        if (!sessionStorage.getItem('visited')) {
            sessionStorage.setItem('visited', 'true');
        }
        const checkAndFetchLocation = async () => {
            try {
                const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                const data = response.data;
                const allData = response.data;

                const hasLocationType = Array.isArray(data?.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Location');
                const hasGeoFencing = Array.isArray(data?.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Geo-fencing');
                const hasTimeRouting = Array.isArray(data?.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Time');
                const hasDeviceRouting = Array.isArray(data?.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Device');

                if (hasLocationType || hasGeoFencing) {
                    setLocationRequired(true);
                    console.log('📍 Location-based routing or geo-fencing detected in data');
                }
                
                // For time-based and device routing, collect location data for analytics
                if ((hasTimeRouting || hasDeviceRouting) && !hasLocationType && !hasGeoFencing) {
                    console.log('⏰🔧 Time-based or Device routing detected - will collect location if available for analytics');
                }

                if ((hasLocationType || hasGeoFencing || hasTimeRouting || hasDeviceRouting) && (!currentLocation || !userLatLng)) {
                    if (navigator.geolocation) {
                        // Check location permission first
                        if (navigator.permissions) {
                            navigator.permissions.query({ name: 'geolocation' }).then(function (result) {
                                console.log('📍 Location permission status:', result.state, 'isMobile:', isMobile());
                                if (result.state === 'denied') {
                                    console.log('❌ Location permission denied');
                                    setShowLocationPrompt(true);
                                    setError('Location access is required for location-based routing or geo-fencing but permission was denied.');
                                    return;
                                } else if (result.state === 'prompt' && isMobile()) {
                                    console.log('📱 Mobile device needs location permission');
                                    setShowLocationPrompt(true);
                                    return;
                                }
                            }).catch(err => {
                                console.log('⚠️ Permission query failed:', err, 'Proceeding with geolocation request');
                            });
                        } else if (isMobile()) {
                            // On mobile, if permissions API is not available, show prompt
                            console.log('📱 Mobile device without permissions API - showing location prompt');
                            setShowLocationPrompt(true);
                            return;
                        }

                        getGeolocation({
                                enableHighAccuracy: true,
                                timeout: isMobile() ? 20000 : 15000, // Longer timeout for mobile
                                maximumAge: isMobile() ? 300000 : 60000 // Longer cache for mobile
                            })
                            .then(async (coords) => {
                                console.log('✅ Location access granted (cached helper):', coords);
                                setShowLocationPrompt(false);
                                const { lat: latitude, lng: longitude } = coords;
                                
                                // Set all location states
                                setUserLatLng({ lat: latitude, lng: longitude });
                                setLocation({ lat: latitude, lng: longitude });
                                
                                console.log('📱 Mobile location data set:', {
                                    userLatLng: { lat: latitude, lng: longitude },
                                    location: { lat: latitude, lng: longitude },
                                    isMobile: isMobile()
                                });

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

                                        if (!currentLocationAutoSetRef.current) {
                                            setCurrentLocation(detectedCity);
                                            currentLocationAutoSetRef.current = true;
                                        }
                                        setLocationDataReady(true);
                                        console.log('✅ Location data ready for redirection logic');
                                    } catch (err) {
                                        setCurrentLocation(`${latitude},${longitude}`);
                                        console.log('⚠️ Error getting location name, using coordinates:', `${latitude},${longitude}`);
                                        setLocationDataReady(true);
                                    }
                                } else {
                                    // Even if we have currentLocation, mark as ready
                                    setLocationDataReady(true);
                                }
                            },
                                (error) => {
                                    console.error('🚫 Geolocation error (helper):', error);
                                    console.log('📍 Location required but access failed (helper)');

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
                                        import('./api').then(({ logErrorToTetr }) => {
                                            try { logErrorToTetr(error, { source: 'geolocation', id }); } catch (e) { }
                                        }).catch(() => { });
                                    } catch (e) { }
                                },
                                {
                                    enableHighAccuracy: true,
                                    timeout: 15000,
                                    maximumAge: 60000
                                }
                            );
                    }
                }
            } catch (error) {
                console.error('Error fetching barcode details:', error);
            } finally {
                setInitialDataCheckComplete(true);
            }
        };
        checkAndFetchLocation();
    }, []);

    // Guard ref to ensure the scan/redirection flow runs only once
    const scanSentRef = useRef(false);
    // Geolocation caching to avoid multiple prompts / duplicate requests
    const geolocationPromiseRef = useRef(null);
    const lastGeolocationRef = useRef(null);

    const getGeolocation = (options) => {
        // Default options with mobile-specific adjustments
        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: isMobile() ? 25000 : 15000, // Longer timeout for mobile
            maximumAge: isMobile() ? 300000 : 60000 // Longer cache for mobile (5 min vs 1 min)
        };
        const finalOptions = { ...defaultOptions, ...options };
        
        console.log('🔍 Geolocation options:', finalOptions, 'isMobile:', isMobile());
        
        if (lastGeolocationRef.current) {
            console.log('📍 Using cached location:', lastGeolocationRef.current);
            return Promise.resolve(lastGeolocationRef.current);
        }
        if (geolocationPromiseRef.current) {
            console.log('⏳ Geolocation request already in progress');
            return geolocationPromiseRef.current;
        }
        if (!navigator.geolocation) {
            return Promise.reject(new Error('Geolocation is not supported by this browser.'));
        }

        geolocationPromiseRef.current = new Promise((resolve, reject) => {
            console.log('🌍 Starting geolocation request with options:', finalOptions);
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                    lastGeolocationRef.current = coords;
                    console.log('✅ Geolocation success:', coords, 'Accuracy:', position.coords.accuracy, 'meters');
                    resolve(coords);
                },
                async (err) => {
                    console.error('❌ Browser geolocation failed:', {
                        message: err && err.message,
                        code: err && err.code,
                        isMobile: isMobile(),
                        userAgent: navigator.userAgent
                    });

                    // If permission was explicitly denied, do not attempt IP fallback.
                    if (err && err.code === 1) {
                        console.log('🚫 Permission denied - no fallback');
                        reject(err);
                        return;
                    }

                    // If the failure is due to insecure origin, try IP-based fallback (approximate).
                    const isInsecureOrigin = err && err.message && /Only secure origins are allowed/i.test(err.message);
                    if (isInsecureOrigin || (err && err.code === 2)) { // POSITION_UNAVAILABLE
                        try {
                            console.log('🔄 Attempting IP-based geolocation fallback (approximate).');
                            const res = await fetch('https://ipapi.co/json');
                            if (res.ok) {
                                const ipJson = await res.json();
                                const lat = parseFloat(ipJson.latitude ?? ipJson.lat);
                                const lon = parseFloat(ipJson.longitude ?? ipJson.lon ?? ipJson.longitude);
                                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                                    const coords = { lat, lng: lon };
                                    lastGeolocationRef.current = coords;
                                    console.log('✅ IP-based geolocation success:', coords);
                                    resolve(coords);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.warn('❌ IP-based geolocation fallback failed:', e);
                            // fallthrough to reject below
                        }
                    }

                    reject(err);
                },
                finalOptions
            );
        }).finally(() => {
            geolocationPromiseRef.current = null;
        });

        return geolocationPromiseRef.current;
    };

    // Reset scan guard when `id` changes so new barcode IDs can trigger the flow again
    useEffect(() => {
        scanSentRef.current = false;
    }, [id]);

    const requestLocationPermission = async () => {
        setShowLocationPrompt(false);
        setError(null);

        try {
            console.log('📱 Requesting location permission on mobile:', isMobile());
            const coords = await getGeolocation({
                enableHighAccuracy: true,
                timeout: isMobile() ? 30000 : 15000, // Even longer timeout for explicit permission request
                maximumAge: 0 // Don't use cached location for explicit requests
            });
            
            console.log('✅ Location permission granted:', coords);
            
            // Set all location states explicitly
            setUserLatLng(coords);
            setLocation(coords);
            
            // Store in lastGeolocationRef to ensure it's available for API calls
            lastGeolocationRef.current = coords;
            
            console.log('📍 All location data set:', {
                userLatLng: coords,
                location: coords,
                lastGeolocationRef: lastGeolocationRef.current,
                isMobile: isMobile()
            });
            
            // Optionally get city name
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`);
                const locData = await res.json();
                const detectedCity = locData.address.city || 
                                   locData.address.town || 
                                   locData.address.village ||
                                   coords.lat + ',' + coords.lng;
                setCurrentLocation(detectedCity);
                console.log('🗺️ Location name resolved:', detectedCity);
            } catch {
                setCurrentLocation(`${coords.lat},${coords.lng}`);
                console.log('⚠️ Using coordinates as location name');
            }

            // Mark location data as ready AFTER everything is set
            setLocationDataReady(true);
            console.log('✅ Location data ready - proceeding with redirection logic');

        } catch (error) {
            console.error("❌ User denied location or location failed:", error);
            // Even if location is denied, mark as ready so app can proceed without location
            setLocationDataReady(true); 
            setShowLocationPrompt(true);
            setError('Location access is required for location-based routing. Please enable location to continue.');
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

    const findMatchingUrlAndTitle = async (jsonData, currentLocation, userLatLng, count) => {
        console.log(currentLocation, "currentLocation FUN");
        console.log(jsonData, "jsonData");

        const effectiveUserLatLng = userLatLng || lastGeolocationRef.current || null;
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
            console.log(item.type, "ITEM");

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
                console.log(currentLocation, "currentLocation IF");
                if (details.url) {
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

            if (item.type === 'Geo-fencing' && effectiveUserLatLng) {
                const apiLat = parseFloat(details.latitude);
                const apiLng = parseFloat(details.longitude);
                const radius = parseInt(details.radius || details.radiusInMeter);
                const url = details.url;
                const userLat = effectiveUserLatLng.lat;
                const userLng = effectiveUserLatLng.lng;
                setLocation({ lat: userLat, lng: userLng });
                const distance = getDistanceFromLatLonInMeters(userLat, userLng, apiLat, apiLng);
                console.log(distance, "distance");
                if (!isNaN(apiLat) && !isNaN(apiLng) && !isNaN(radius) && userLat && userLng) {
                    console.log(userLat, userLng, distance, "USER DATA");
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
                } else {
                    deviceType = 'Desktop';
                }

                let redirectUrl = '';
                if (data.jsonData && Array.isArray(data.jsonData.data)) {
                    const deviceObj = data.jsonData.data.find(
                        item => item.type === 'Device' && item.details && 
                        (item.details.deviceType === deviceType || item.details.device === deviceType)
                    );
                    if (deviceObj && deviceObj.details && deviceObj.details.url) {
                        redirectUrl = deviceObj.details.url;
                        console.log('🔧 Early device detection found URL:', {
                            deviceType,
                            deviceUrl: redirectUrl,
                            deviceDetails: deviceObj.details
                        });
                    }
                }
                if (!redirectUrl) {
                    redirectUrl = data.jsonData?.defaultURL || data.jsonData?.defaultUrl || data.defaultURL || data.defaultUrl || '';
                }
            } catch (error) {
                console.error('Error fetching URL data:', error);
                // Don't set loading to false here - let the main redirect logic handle it
                // setLoading(false);
            }
        };
        fetchUrlData();
    }, [id, sessionExpired]);

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
        console.log('🖼️ Loading image set:', randomImage);
    }, []);


    useEffect(() => {
        const fetchAndSendBarcodeDetails = async () => {

            console.log("fetchAndSendBarcodeDetails called", {
                id,
                scanSent: scanSentRef.current,
                locationDataReady,
                userLatLng,
                currentLocation,
                locationRequired
            });

            // Prevent duplicate calls
            if (scanSentRef.current) return;
            
            // Wait for initial data check to complete
            if (!initialDataCheckComplete) {
                console.log("⏳ Waiting for initial data check to complete...");
                return;
            }

            try {
                const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                const data = response.data;
                const hasLocationRouting =
                    Array.isArray(data?.jsonData?.data) &&
                    data.jsonData.data.some(item => item.type === "Location");
                
                const hasGeoFencing = 
                    Array.isArray(data?.jsonData?.data) &&
                    data.jsonData.data.some(item => item.type === "Geo-fencing");

                const hasTimeRouting = 
                    Array.isArray(data?.jsonData?.data) &&
                    data.jsonData.data.some(item => item.type === "Time");

                const hasDeviceRouting = 
                    Array.isArray(data?.jsonData?.data) &&
                    data.jsonData.data.some(item => item.type === "Device");

                // Critical fix: Wait for location data to be ready if any location-based feature is detected
                // Since time routing and device routing BOTH trigger location collection, we should wait for them
                
                const locationCollectionTriggered = hasGeoFencing || hasLocationRouting || hasTimeRouting || hasDeviceRouting;
                
                // If no location-based routing was detected, mark location as ready immediately
                if (!locationCollectionTriggered && !locationDataReady) {
                    console.log("📍 No location-based routing detected - proceeding without location wait");
                    setLocationDataReady(true);
                }
                
                if (locationCollectionTriggered && !locationDataReady) {
                    if (hasTimeRouting) {
                        console.log("⏰🔍 TIME ROUTING: Waiting for location data before redirect...", {
                            hasGeoFencing,
                            hasLocationRouting, 
                            hasTimeRouting,
                            hasDeviceRouting,
                            locationDataReady,
                            userLatLng: !!userLatLng,
                            lastGeolocation: !!lastGeolocationRef.current,
                            currentLocation,
                            locationRequired
                        });
                    } else if (hasDeviceRouting) {
                        console.log("🔧📍 DEVICE ROUTING: Waiting for location data before redirect...", {
                            hasGeoFencing,
                            hasLocationRouting, 
                            hasTimeRouting,
                            hasDeviceRouting,
                            locationDataReady,
                            userLatLng: !!userLatLng,
                            lastGeolocation: !!lastGeolocationRef.current,
                            currentLocation,
                            deviceType
                        });
                    } else {
                        console.log("⏳ Location collection was triggered but location not ready yet. Waiting...", {
                            hasGeoFencing,
                            hasLocationRouting, 
                            hasTimeRouting,
                            hasDeviceRouting,
                            locationDataReady,
                            userLatLng: !!userLatLng,
                            lastGeolocation: !!lastGeolocationRef.current,
                            currentLocation
                        });
                    }
                    return;
                }
                
                // Add debug message when location is ready and proceeding
                if (locationCollectionTriggered && locationDataReady) {
                    console.log("✅ Location data ready - proceeding with API call and redirect", {
                        hasTimeRouting,
                        hasGeoFencing,
                        hasLocationRouting,
                        hasDeviceRouting,
                        userLatLng: !!userLatLng,
                        lastGeolocation: !!lastGeolocationRef.current
                    });
                }

                const ipAddress = await fetch("https://api.ipify.org?format=json")
                    .then(res => res.json())
                    .then(json => json.ip)
                    .catch(() => null);

                const userAgent = navigator.userAgent || navigator.vendor || window.opera;
                let deviceType = "";
                if (/android/i.test(userAgent)) deviceType = "Android";
                else if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) deviceType = "iPhone";
                else deviceType = "Desktop";

                // Lock further runs
                scanSentRef.current = true;
                
                // Get the most reliable location data available
                let effectiveLat = null;
                let effectiveLng = null;
                let effectiveUserLatLng = null;

                // Priority: userLatLng > lastGeolocationRef > currentLocation coordinates
                if (userLatLng?.lat && userLatLng?.lng) {
                    effectiveLat = userLatLng.lat;
                    effectiveLng = userLatLng.lng;
                    effectiveUserLatLng = userLatLng;
                } else if (lastGeolocationRef.current?.lat && lastGeolocationRef.current?.lng) {
                    effectiveLat = lastGeolocationRef.current.lat;
                    effectiveLng = lastGeolocationRef.current.lng;
                    effectiveUserLatLng = lastGeolocationRef.current;
                } else if (location?.lat && location?.lng) {
                    effectiveLat = location.lat;
                    effectiveLng = location.lng;
                    effectiveUserLatLng = location;
                }

                console.log("📊 Location data for API:", {
                    effectiveLat,
                    effectiveLng,
                    effectiveUserLatLng,
                    userLatLng,
                    locationState: location,
                    lastGeolocation: lastGeolocationRef.current,
                    hasTimeRouting,
                    hasLocationRouting,
                    hasGeoFencing,
                    isMobile: isMobile(),
                    locationDataReady,
                    currentLocation
                });

                const barcodeDetails = data?.jsonData?.data || {};
                const payload = {
                    barcodeDetails: {
                        ...barcodeDetails,
                        barcodeImageUrl: data?.barcodeImageUrl,
                        defaultURL: data?.defaultURL,
                    },
                    barcodeId: data?.id,
                    userLatLng: effectiveUserLatLng,
                    latitude: effectiveLat,
                    longitude: effectiveLng,
                    deviceType: deviceType,
                    ipAddress: ipAddress || null,
                };

                console.log("📤 Prepared payload for API:", payload);
                console.log("📍 Final location data being sent:", {
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    userLatLng: payload.userLatLng,
                    hasLocationData: !!(payload.latitude && payload.longitude),
                    deviceType: payload.deviceType,
                    ipAddress: payload.ipAddress
                });

                setLoading(true);

                const scanUrl = "https://tandt.api.sakksh.com/genbarcode/scan";

                let redirectUrl = "";

                // Check for device-specific rule
                if (data.jsonData && Array.isArray(data.jsonData.data)) {
                    const deviceObj = data.jsonData.data.find(
                        item =>
                            item.type === "Device" &&
                            (item.details?.deviceType === deviceType || item.details?.device === deviceType)
                    );
                    if (deviceObj?.details?.url) {
                        redirectUrl = deviceObj.details.url;
                        console.log("🔧 Device-specific URL found:", {
                            deviceType,
                            deviceUrl: redirectUrl,
                            deviceDetails: deviceObj.details
                        });
                    }
                }

                // If no device URL → check dynamic routing
                if (!redirectUrl) {
                    const dynamicResult = await findMatchingUrlAndTitle(
                        data.jsonData,
                        currentLocation,
                        effectiveUserLatLng || userLatLng
                    );
                    redirectUrl = dynamicResult.url;
                    console.log("Dynamic routing result:", dynamicResult);
                }

                // Fallback to default
                if (!redirectUrl) {
                    redirectUrl =
                        data.jsonData?.defaultURL ||
                        data.jsonData?.defaultUrl ||
                        data.defaultURL ||
                        data.defaultUrl ||
                        "";
                }

                if (redirectUrl) {
                    const finalUrl = redirectUrl.startsWith("http")
                        ? redirectUrl
                        : `https://${redirectUrl}`;

                    await api.post(scanUrl, payload);
                    console.log("Scan details sent successfully");
                    
                    // Small delay to ensure loading screen is visible and API call completes
                    // This gives users time to see the feature image before redirect
                    setTimeout(() => {
                        console.log("Redirecting to:", finalUrl);
                        window.location.replace(finalUrl);
                    }, 500); // 500ms delay to show the loading screen
                } else {
                    // If no redirect URL found, try to get the default URL from the original data
                    console.log("No redirect URL found - checking for any default URL");
                    const fallbackUrl = data?.defaultURL || data?.defaultUrl || 
                                       data?.jsonData?.defaultURL || data?.jsonData?.defaultUrl;
                    
                    if (fallbackUrl) {
                        const finalUrl = fallbackUrl.startsWith("http") ? fallbackUrl : `https://${fallbackUrl}`;
                        console.log("Using fallback URL:", finalUrl);
                        await api.post(scanUrl, payload);
                        setTimeout(() => {
                            window.location.replace(finalUrl);
                        }, 500);
                    } else {
                        // Absolutely no URL found - show details page
                        console.log("No URL found at all - showing details page");
                        setShowDetails(true);
                        setLoading(false);
                    }
                }
            } catch (error) {
                console.error("Failed to send barcode details or redirect:", error);
                
                // On error, try to get any available default URL and redirect anyway
                try {
                    const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
                    const data = response.data;
                    const fallbackUrl = data?.defaultURL || data?.defaultUrl || 
                                       data?.jsonData?.defaultURL || data?.jsonData?.defaultUrl;
                    
                    if (fallbackUrl) {
                        const finalUrl = fallbackUrl.startsWith("http") ? fallbackUrl : `https://${fallbackUrl}`;
                        console.log("Error occurred, using fallback URL:", finalUrl);
                        setTimeout(() => {
                            window.location.replace(finalUrl);
                        }, 1000);
                    } else {
                        // Only show details page if absolutely no URL is available
                        console.log("No fallback URL available - showing details page");
                        setShowDetails(true);
                        setLoading(false);
                    }
                } catch (fallbackError) {
                    console.error("Fallback also failed:", fallbackError);
                    // Keep loading screen - don't show broken page
                    console.log("Keeping loading screen active due to errors");
                }
            }
        };

        if (id) {
            fetchAndSendBarcodeDetails();
        }
        console.log("RENDER L");

    }, [id, locationDataReady, initialDataCheckComplete]);


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

    if (showLocationPrompt) {
        return (
            <div style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '2rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📍</div>
                    <h2 style={{ color: '#1976d2', marginBottom: '1rem' }}>{locationRequired ? 'Location Access Required' : 'Location Access'}</h2>
                    <p style={{ color: '#666', marginBottom: '1rem', lineHeight: '1.5' }}>
                        {locationRequired
                            ? 'This QR code uses location-based routing to show you the most relevant content for your area.'
                            : 'This app can provide a better experience with location access. Please enable location services.'}
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
                            console.log('🚫 User chose to continue without location');
                            setShowLocationPrompt(false);
                            setLocationDataReady(true); // Mark as ready so redirection can proceed
                            setError(null);
                        }}
                    >
                        Continue Without Location
                    </button>
                </div>
            </div>
        );
    }

    // Keep showing loading screen until we explicitly want to show the details page
    // Only show details page when loading is false AND showDetails is true
    if (loading || !showDetails) {
        return (
            <div style={mobile ? mobileStyles.loadingContainer : desktopStyles.loadingContainer}>
                <div style={{ textAlign: 'center' }}>
                    {loadingImage ? (
                        <img 
                            src={loadingImage} 
                            alt="Loading" 
                            style={{ maxWidth: '100%', height: 'auto', marginBottom: '20px' }}
                            onError={(e) => {
                                console.log('🖼️ Image failed to load, hiding');
                                e.target.style.display = 'none';
                            }}
                        />
                    ) : (
                        <div style={{ 
                            width: '200px', 
                            height: '200px', 
                            backgroundColor: '#e3f2fd', 
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto',
                            fontSize: '48px'
                        }}>
                            📱
                        </div>
                    )}
                    <div style={{ 
                        color: '#1976d2', 
                        fontSize: '18px', 
                        fontWeight: 'bold',
                        marginBottom: '10px'
                    }}>
                        Processing QR Code...
                    </div>
                    <div style={{ 
                        color: '#666', 
                        fontSize: '14px',
                        maxWidth: '300px',
                        margin: '0 auto',
                        lineHeight: '1.4'
                    }}>
                        {locationRequired ? 'Collecting location data for personalized content...' : 'Analyzing QR code data...'}
                    </div>
                </div>
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