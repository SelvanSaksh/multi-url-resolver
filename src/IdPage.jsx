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
    const [ip, setIp] = useState("");

    useEffect(() => {
        const fetchIP = async () => {
            try {
                const response = await fetch("https://api.ipify.org?format=json");
                const data = await response.json();
                setIp(data.ip);
            } catch (err) {
                console.error("Failed to fetch IP:", err);
            }
        };

        fetchIP();
    }, []);

    useEffect(() => {
        getGeolocation({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 })
            .then(coords => {
                setLocation({ lat: coords.lat, lng: coords.lng });
                setUserLatLng({ lat: coords.lat, lng: coords.lng });
                console.log('Location fetched (cached):', coords);
            })
            .catch(err => {
                console.error('Geolocation error:', err);
                const code = err && err.code;
                if (code === 1) {
                    setShowLocationPrompt(true);
                    setError('Location access denied. Please enable location services to use location-based routing.');
                } else {
                    setError(err.message || String(err));
                }
            });
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

                const hasLocationType = Array.isArray(data?.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Location');

                if (hasLocationType) {
                    setLocationRequired(true);
                    console.log('📍 Location-based routing detected in data');
                }

                if (hasLocationType && (!currentLocation || !userLatLng)) {
                    if (navigator.geolocation) {
                        // Check location permission first
                        if (navigator.permissions) {
                            navigator.permissions.query({ name: 'geolocation' }).then(function (result) {
                                console.log('📍 Location permission status:', result.state);
                                if (result.state === 'denied') {
                                    console.log('❌ Location permission denied');
                                    setShowLocationPrompt(true);
                                    setError('Location access is required for location-based routing but permission was denied.');
                                    return;
                                }
                            });
                        }

                        getGeolocation()
                            .then(async (coords) => {
                                console.log('✅ Location access granted (cached helper)');
                                setShowLocationPrompt(false);
                                const { lat: latitude, lng: longitude } = coords;
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

                                        if (!currentLocationAutoSetRef.current) {
                                            setCurrentLocation(detectedCity);
                                            currentLocationAutoSetRef.current = true;
                                        }
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
                                        ipAddress: ip || null,
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
                            ipAddress: ip || null,
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
    // Guard ref to ensure the scan/redirection flow runs only once
    const scanSentRef = useRef(false);
    // Geolocation caching to avoid multiple prompts / duplicate requests
    const geolocationPromiseRef = useRef(null);
    const lastGeolocationRef = useRef(null);

    const getGeolocation = (options = { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }) => {
        if (lastGeolocationRef.current) {
            return Promise.resolve(lastGeolocationRef.current);
        }
        if (geolocationPromiseRef.current) {
            return geolocationPromiseRef.current;
        }
        if (!navigator.geolocation) {
            return Promise.reject(new Error('Geolocation is not supported by this browser.'));
        }

        geolocationPromiseRef.current = new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
                    lastGeolocationRef.current = coords;
                    resolve(coords);
                },
                async (err) => {
                    console.warn('Browser geolocation failed:', err && err.message, err && err.code);

                    // If permission was explicitly denied, do not attempt IP fallback.
                    if (err && err.code === 1) {
                        reject(err);
                        return;
                    }

                    // If the failure is due to insecure origin, try IP-based fallback (approximate).
                    const isInsecureOrigin = err && err.message && /Only secure origins are allowed/i.test(err.message);
                    if (isInsecureOrigin) {
                        try {
                            console.log('Attempting IP-based geolocation fallback (approximate).');
                            const res = await fetch('https://ipapi.co/json');
                            if (res.ok) {
                                const ipJson = await res.json();
                                const lat = parseFloat(ipJson.latitude ?? ipJson.lat);
                                const lon = parseFloat(ipJson.longitude ?? ipJson.lon ?? ipJson.longitude);
                                if (Number.isFinite(lat) && Number.isFinite(lon)) {
                                    const coords = { lat, lng: lon };
                                    lastGeolocationRef.current = coords;
                                    console.log('IP-based geolocation success:', coords);
                                    resolve(coords);
                                    return;
                                }
                            }
                        } catch (e) {
                            console.warn('IP-based geolocation fallback failed:', e);
                            // fallthrough to reject below
                        }
                    }

                    reject(err);
                },
                options
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

    const requestLocationPermission = () => {
        console.log('🔄 Requesting location permission...');
        setShowLocationPrompt(false);
        setError(null);

        if (navigator.geolocation) {
            getGeolocation()
                .then(async (coords) => {
                    console.log('✅ Location permission granted (helper)');
                    const { lat: latitude, lng: longitude } = coords;
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
                        if (!currentLocationAutoSetRef.current) {
                            setCurrentLocation(detectedCity);
                            currentLocationAutoSetRef.current = true;
                        }
                        console.log('🏙️ Location detected:', detectedCity);
                    } catch (err) {
                        if (!currentLocationAutoSetRef.current) {
                            setCurrentLocation(`${latitude},${longitude}`);
                            currentLocationAutoSetRef.current = true;
                        }
                    }
                })
                .catch((error) => {
                    console.error('🚫 Location permission denied again (helper):', error);
                    setShowLocationPrompt(true);
                    if (error.code === error.PERMISSION_DENIED) {
                        setError('Location access is required for location-based routing. Please enable location in your browser settings.');
                    } else {
                        setError('Unable to access location. Please check your location settings and try again.');
                    }
                });
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
        // Use effectiveUserLatLng which prefers the React state but falls back
        // to the last cached geolocation (if available). This avoids timing
        // issues where the state update hasn't yet propagated but we have
        // coordinates from the helper.
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
                const clean = str => str ? str.replace(/[^\p{L}\p{N} ]+/gu, '').trim().toLowerCase() : '';
                const currentLocClean = clean(currentLocation);
                const responseCity = clean(details.city);
                const responseState = clean(details.state);
                const responseCountry = clean(details.country);
                const responseStateDistrict = clean(details.state_district);

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
            console.log(effectiveUserLatLng, "userLatLng (effective)");

            if (item.type === 'Geo-fencing' && effectiveUserLatLng) {
                const apiLat = parseFloat(details.latitude);
                const apiLng = parseFloat(details.longitude);
                const radius = parseInt(details.radius || details.radiusInMeter);
                const url = details.url;
                const userLat = effectiveUserLatLng.lat;
                const userLng = effectiveUserLatLng.lng;
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
                }

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
            if (scanSentRef.current) {
                console.log('Scan/redirection already performed; skipping duplicate invocation.');
                return;
            }
            const response = await api.get(`https://tandt.api.sakksh.com/genbarcode/${id}`);
            const data = response.data;
            const hasLocationRouting = Array.isArray(data?.jsonData?.data) &&
                data.jsonData.data.some(item => item.type === 'Location');

            if (hasLocationRouting && !locationDataReady) {
                console.log('🔄 Location routing required but location data not ready yet. Waiting...');
                return;
            }

            try {
                const barcodeDetails = data?.jsonData?.data || {};

                const payload = {
                    barcodeDetails: { ...barcodeDetails, ...{ barcodeImageUrl: data?.barcodeImageUrl, defaultURL: data?.defaultURL } },
                    barcodeId: data?.id,
                    userLatLng,
                    latitude: location?.lat ?? null,
                    longitude: location?.lng ?? null,
                    deviceType: deviceType,
                    ipAddress: ip || null,
                };

                console.log('Prepared payload (will send scan):', payload);

                setLoading(true);

                const scanUrl = 'https://tandt.api.sakksh.com/genbarcode/scan';
                const scanResponse = await api.post(scanUrl, payload);
                // Mark that we have sent the scan to avoid duplicate sends
                scanSentRef.current = true;

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

                    // If there are geo-fencing rules, ensure we have coordinates before matching.
                    const hasGeoFencing = Array.isArray(data.jsonData?.data) && data.jsonData.data.some(item => item.type === 'Geo-fencing');
                    if (hasGeoFencing && !(userLatLng || lastGeolocationRef.current)) {
                        console.log('Geo-fencing rules present but no user coords — attempting to obtain coordinates...');
                        try {
                            const coords = await getGeolocation({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
                            if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
                                setUserLatLng({ lat: coords.lat, lng: coords.lng });
                                setLocation({ lat: coords.lat, lng: coords.lng });
                                console.log('Coordinates obtained for geo-fencing:', coords);
                            }
                        } catch (geoErr) {
                            console.warn('Failed to obtain coords for geo-fencing:', geoErr);
                            if (geoErr && geoErr.code === 1) {
                                // Permission denied — show prompt and stop processing until user enables it
                                setShowLocationPrompt(true);
                                setError('Location access denied. Please enable location services to continue.');
                                return;
                            }
                            // other errors: IP fallback may have been applied inside getGeolocation; proceed
                        }
                    }

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

                setShowDetails(true);
            } catch (error) {
                console.error('Failed to send barcode details or redirect:', error);
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

    // Show location permission prompt when the app needs location or the user denied permission
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