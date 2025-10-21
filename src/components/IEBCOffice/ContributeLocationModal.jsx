// src/components/IEBCOffice/ContributeLocationModal.jsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useContributeLocation } from '@/hooks/useContributeLocation';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';
import L from 'leaflet';

// Complete list of 47 Kenyan counties
const KENYAN_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet",
  "Embu", "Garissa", "Homa Bay", "Isiolo", "Kajiado",
  "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga",
  "Kisii", "Kisumu", "Kitui", "Kwale", "Laikipia",
  "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi",
  "Nakuru", "Nandi", "Narok", "Nyamira", "Nyandarua",
  "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River",
  "Tharaka-Nithi", "Trans Nzoia", "Turkana", "Uasin Gishu",
  "Vihiga", "Wajir", "West Pokot"
];

// Google Maps URL parsing function
const parseGoogleMapsInput = (input) => {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  
  // Pattern 1: Direct coordinates (e.g., "-1.2921,36.8219")
  const directCoords = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (directCoords) {
    const lat = parseFloat(directCoords[1]);
    const lng = parseFloat(directCoords[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'direct_paste' };
    }
  }
  
  // Pattern 2: @lat,lng,zoom format
  const atPattern = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*),?(\d+\.?\d*)?z?/);
  if (atPattern) {
    const lat = parseFloat(atPattern[1]);
    const lng = parseFloat(atPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'at_pattern', zoom: parseFloat(atPattern[3]) };
    }
  }
  
  // Pattern 3: ?q=lat,lng format
  const qPattern = trimmed.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qPattern) {
    const lat = parseFloat(qPattern[1]);
    const lng = parseFloat(qPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'q_parameter' };
    }
  }
  
  // Pattern 4: !3dlat!4dlng format
  const dataPattern = trimmed.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (dataPattern) {
    const lat = parseFloat(dataPattern[1]);
    const lng = parseFloat(dataPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'data_parameter' };
    }
  }
  
  // Pattern 5: /place/ with coordinates
  const placePattern = trimmed.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placePattern) {
    const lat = parseFloat(placePattern[1]);
    const lng = parseFloat(placePattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'place_path' };
    }
  }
  
  // Pattern 6: Short URL - we'll handle this client-side by following redirects
  if (trimmed.match(/goo\.gl\/maps\/|maps\.app\.goo\.gl/)) {
    return { requiresExpansion: true, shortUrl: trimmed, source: 'short_url' };
  }
  
  // Pattern 7: Place name only
  const placeNamePattern = trimmed.match(/\/place\/([^/@?]+)/);
  if (placeNamePattern) {
    const placeName = decodeURIComponent(placeNamePattern[1]).replace(/\+/g, ' ');
    return { placeName, requiresGeocoding: true, source: 'place_name' };
  }
  
  return null;
};

const isValidCoordinate = (lat, lng) => {
  const KENYA_BOUNDS = {
    minLat: -4.678, maxLat: 5.506,
    minLng: 33.908, maxLng: 41.899
  };
  
  return (!isNaN(lat) && !isNaN(lng) &&
          lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat &&
          lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng);
};

// Client-side URL expansion function
const expandShortUrl = async (shortUrl) => {
  try {
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow'
    });
    return response.url;
  } catch (error) {
    console.error('Error expanding URL:', error);
    return shortUrl; // Return original if expansion fails
  }
};

const ContributeLocationModal = ({ isOpen, onClose, onSuccess, userLocation }) => {
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [googleMapsInput, setGoogleMapsInput] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [isExpandingUrl, setIsExpandingUrl] = useState(false);
  const [formData, setFormData] = useState({
    submitted_office_location: '',
    submitted_county: '',
    submitted_constituency: '',
    submitted_landmark: ''
  });
  
  const [agreement, setAgreement] = useState(false);
  const [mapCenter, setMapCenter] = useState([-1.286389, 36.817223]);
  const [mapZoom, setMapZoom] = useState(6);
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [contributionId, setContributionId] = useState(null);
  
  const mapRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const markerRef = useRef(null);
  
  const { getCurrentPosition, convertImageToWebP, submitContribution, isSubmitting, error } = useContributeLocation();

  // Method selection handlers
  const handleMethodSelect = (method) => {
    setSelectedMethod(method);
    setStep(2);
    
    if (method === 'current_location') {
      handleCurrentLocation();
    } else if (method === 'drop_pin') {
      initializeMapWithUserLocation();
    }
  };

  const handleCurrentLocation = async () => {
    setLocationError(null);
    try {
      const pos = await getCurrentPosition();
      const capturedPosition = { lat: pos.latitude, lng: pos.longitude };
      const limitedAccuracy = Math.min(pos.accuracy, 1000);
      
      setPosition(capturedPosition);
      setAccuracy(limitedAccuracy);
      setMapCenter([pos.latitude, pos.longitude]);
      setMapZoom(16);
      
      if (mapRef.current) {
        mapRef.current.flyTo([pos.latitude, pos.longitude], 16, { duration: 1 });
        addMarkerToMap(capturedPosition);
        addAccuracyCircle(capturedPosition, limitedAccuracy);
        
        // Show accuracy guidance
        if (limitedAccuracy > 100) {
          setLocationError(`GPS accuracy is low (±${Math.round(limitedAccuracy)}m). Please move to an open area or manually adjust the pin.`);
        } else if (limitedAccuracy <= 20) {
          setLocationError(`✓ Good accuracy (±${Math.round(limitedAccuracy)}m). You're within the recommended 20m range.`);
        }
      }
    } catch (err) {
      console.error('Error capturing location:', err);
      setLocationError(err.message || 'Failed to get current location');
    }
  };

  const handleGoogleMapsParse = async () => {
    if (!googleMapsInput.trim()) return;
    
    setIsExpandingUrl(true);
    setLocationError(null);
    
    try {
      let result = parseGoogleMapsInput(googleMapsInput);
      
      // Handle short URL expansion
      if (result?.requiresExpansion) {
        const expandedUrl = await expandShortUrl(result.shortUrl);
        result = parseGoogleMapsInput(expandedUrl);
      }
      
      if (result?.lat && result?.lng) {
        setParseResult(result);
        setPosition({ lat: result.lat, lng: result.lng });
        setMapCenter([result.lat, result.lng]);
        setMapZoom(16);
        
        if (mapRef.current) {
          mapRef.current.flyTo([result.lat, result.lng], 16, { duration: 1 });
          addMarkerToMap({ lat: result.lat, lng: result.lng });
          addAccuracyCircle({ lat: result.lat, lng: result.lng }, 5);
        }
        
        // Extract place name from URL for auto-fill
        const placeNameMatch = googleMapsInput.match(/\/place\/([^/@?]+)/);
        if (placeNameMatch) {
          const placeName = decodeURIComponent(placeNameMatch[1]).replace(/\+/g, ' ');
          setFormData(prev => ({ ...prev, submitted_office_location: placeName }));
        }
      } else if (result?.requiresGeocoding) {
        setLocationError('Could not extract exact coordinates. Please place a pin on the map manually.');
        setSelectedMethod('drop_pin');
        initializeMapWithUserLocation();
      } else {
        setLocationError('Could not parse input. Please check the format and try again.');
      }
    } catch (err) {
      console.error('Error parsing Google Maps input:', err);
      setLocationError('Failed to process the Google Maps link');
    } finally {
      setIsExpandingUrl(false);
    }
  };

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
    setIsMapReady(true);
    
    if (position) {
      addMarkerToMap(position);
      addAccuracyCircle(position, accuracy);
    }
  }, [position, accuracy]);

  const addMarkerToMap = useCallback((position) => {
    if (!mapRef.current || !position) return;
    
    if (markerRef.current) {
      mapRef.current.removeLayer(markerRef.current);
    }
    
    const customIcon = L.divIcon({
      className: 'contribution-marker',
      html: `<div style="width: 24px; height: 24px; background: #34C759; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
               <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
             </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    
    markerRef.current = L.marker([position.lat, position.lng], {
      icon: customIcon,
      draggable: selectedMethod === 'drop_pin'
    }).addTo(mapRef.current);
    
    if (selectedMethod === 'drop_pin') {
      markerRef.current.on('dragend', (event) => {
        const newPosition = event.target.getLatLng();
        setPosition({ lat: newPosition.lat, lng: newPosition.lng });
        setAccuracy(5);
      });
    }
  }, [selectedMethod]);

  const addAccuracyCircle = useCallback((position, accuracy) => {
    if (!mapRef.current || !position || !accuracy) return;
    
    if (accuracyCircleRef.current) {
      mapRef.current.removeLayer(accuracyCircleRef.current);
    }
    
    const limitedAccuracy = Math.min(accuracy, 1000);
    accuracyCircleRef.current = L.circle([position.lat, position.lng], {
      radius: limitedAccuracy,
      color: '#34C759',
      fillColor: '#34C759',
      fillOpacity: 0.1,
      weight: 2,
      opacity: 0.6
    }).addTo(mapRef.current);
  }, []);

  const initializeMapWithUserLocation = useCallback(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const userPos = { lat: userLocation.latitude, lng: userLocation.longitude };
      setMapCenter([userLocation.latitude, userLocation.longitude]);
      setMapZoom(16);
      
      if (mapRef.current) {
        mapRef.current.flyTo([userLocation.latitude, userLocation.longitude], 16, { duration: 1 });
      }
    }
  }, [userLocation]);

  const handleMapClick = useCallback((e) => {
    if (selectedMethod === 'drop_pin') {
      const clickedPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPosition(clickedPosition);
      setAccuracy(5);
      
      if (mapRef.current) {
        mapRef.current.flyTo([e.latlng.lat, e.latlng.lng], 16, { duration: 0.5 });
        addMarkerToMap(clickedPosition);
        addAccuracyCircle(clickedPosition, 5);
      }
    }
  }, [selectedMethod, addMarkerToMap, addAccuracyCircle]);

  const handleImageSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be smaller than 5MB');
      }
      
      const webpFile = await convertImageToWebP(file);
      setImageFile(webpFile);
      
      const previewUrl = URL.createObjectURL(webpFile);
      setImagePreview(previewUrl);
    } catch (err) {
      console.error('Error processing image:', err);
      setLocationError(err.message);
    }
  }, [convertImageToWebP]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setStep(3);
  };

  const handleFinalSubmit = async () => {
    if (!position || !agreement) return;
    
    try {
      const contributionData = {
        submitted_latitude: position.lat,
        submitted_longitude: position.lng,
        submitted_accuracy_meters: accuracy,
        submitted_office_location: formData.submitted_office_location,
        submitted_county: formData.submitted_county,
        submitted_constituency: formData.submitted_constituency,
        submitted_landmark: formData.submitted_landmark || notes,
        google_maps_link: selectedMethod === 'google_maps' ? googleMapsInput : null,
        imageFile: imageFile,
        device_metadata: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timestamp: new Date().toISOString(),
          capture_method: selectedMethod,
          capture_source: parseResult?.source || 'manual'
        },
        submitted_timestamp: new Date().toISOString()
      };
      
      const result = await submitContribution(contributionData);
      setContributionId(result.id);
      setSubmissionSuccess(true);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      setStep(4);
    } catch (err) {
      console.error('Submission error:', err);
      setLocationError(err.message);
    }
  };

  const resetForm = useCallback(() => {
    setStep(1);
    setSelectedMethod(null);
    setPosition(null);
    setAccuracy(null);
    setImageFile(null);
    setImagePreview(null);
    setNotes('');
    setGoogleMapsInput('');
    setParseResult(null);
    setFormData({
      submitted_office_location: '',
      submitted_county: '',
      submitted_constituency: '',
      submitted_landmark: ''
    });
    setAgreement(false);
    setLocationError(null);
    setSubmissionSuccess(false);
    setContributionId(null);
    
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {step === 1 && 'Contribute IEBC Office Location'}
                {step === 2 && 'Capture Location'}
                {step === 3 && 'Office Details'}
                {step === 4 && 'Submission Complete'}
              </h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {locationError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-sm font-medium text-red-700">{locationError}</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Step 1: Method Selection */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">How would you like to contribute?</h3>
                    <p className="text-gray-600">Choose your preferred method to capture the IEBC office location</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => handleMethodSelect('current_location')}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Use My Current Location</h4>
                          <p className="text-sm text-gray-600">Stand at the IEBC office and capture your GPS coordinates</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleMethodSelect('drop_pin')}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Drop a Pin on Map</h4>
                          <p className="text-sm text-gray-600">Manually place a pin on the exact office location</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleMethodSelect('google_maps')}
                      className="p-4 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all text-left"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Paste Google Maps Link</h4>
                          <p className="text-sm text-gray-600">Share a Google Maps URL or coordinates</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="text-sm text-green-700">
                        <p className="font-medium">Privacy Notice</p>
                        <p>We only collect location data pertaining to IEBC offices for public benefit. No personal information is stored. All submissions are moderated before being published.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Location Capture */}
              {step === 2 && (
                <div className="space-y-6">
                  {selectedMethod === 'current_location' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Capture Your Current Location</h3>
                      <p className="text-gray-600 mb-4">Stand within 20 meters of the IEBC office entrance for best accuracy</p>
                      
                      {position && accuracy && (
                        <div className="bg-blue-50 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-700">
                              Accuracy: ±{Math.round(accuracy)} meters
                            </span>
                            {accuracy <= 20 && (
                              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                ✓ Good Accuracy
                              </span>
                            )}
                          </div>
                          {accuracy > 100 && (
                            <p className="text-sm text-blue-600 mt-1">
                              Move to an open area for better GPS accuracy
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedMethod === 'drop_pin' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Drop a Pin on the Map</h3>
                      <p className="text-gray-600">Click on the exact location of the IEBC office. Drag the pin to adjust.</p>
                    </div>
                  )}

                  {selectedMethod === 'google_maps' && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Paste Google Maps Link</h3>
                      <p className="text-gray-600 mb-4">Paste a Google Maps URL or coordinates in format: -1.2921,36.8219</p>
                      
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={googleMapsInput}
                          onChange={(e) => setGoogleMapsInput(e.target.value)}
                          placeholder="https://maps.google.com/place/... or -1.2921,36.8219"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        />
                        <button
                          onClick={handleGoogleMapsParse}
                          disabled={!googleMapsInput.trim() || isExpandingUrl}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {isExpandingUrl ? 'Processing...' : 'Parse'}
                        </button>
                      </div>
                      
                      {parseResult && (
                        <div className="bg-green-50 rounded-lg p-3 mt-2">
                          <p className="text-sm text-green-700">
                            ✓ Coordinates extracted: {parseResult.lat.toFixed(6)}, {parseResult.lng.toFixed(6)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Map Preview */}
                  {(selectedMethod === 'current_location' || selectedMethod === 'drop_pin' || parseResult) && (
                    <div className="h-64 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
                      <MapContainer
                        center={mapCenter}
                        zoom={mapZoom}
                        className="h-full w-full"
                        onMapReady={handleMapReady}
                        onClick={handleMapClick}
                      >
                        <GeoJSONLayerManager
                          activeLayers={['iebc-offices']}
                          onOfficeSelect={() => {}}
                          selectedOffice={null}
                          onNearbyOfficesFound={() => {}}
                          baseMap="standard"
                        />
                        {userLocation && (
                          <UserLocationMarker
                            position={[userLocation.latitude, userLocation.longitude]}
                            accuracy={Math.min(userLocation.accuracy, 1000)}
                          />
                        )}
                        {position && (
                          <UserLocationMarker
                            position={[position.lat, position.lng]}
                            accuracy={accuracy}
                            color="#34C759"
                          />
                        )}
                      </MapContainer>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!position}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Continue to Details
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Office Details Form */}
              {step === 3 && (
                <form onSubmit={handleFormSubmit} className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Office Information</h3>
                    <p className="text-gray-600">Provide details about the IEBC office</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Office Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.submitted_office_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitted_office_location: e.target.value }))}
                        placeholder="e.g., IEBC Eldoret County Office"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          County *
                        </label>
                        <select
                          required
                          value={formData.submitted_county}
                          onChange={(e) => setFormData(prev => ({ ...prev, submitted_county: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="">Select County</option>
                          {KENYAN_COUNTIES.map(county => (
                            <option key={county} value={county}>{county}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Constituency *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.submitted_constituency}
                          onChange={(e) => setFormData(prev => ({ ...prev, submitted_constituency: e.target.value }))}
                          placeholder="e.g., Embakasi West"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nearby Landmark (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.submitted_landmark}
                        onChange={(e) => setFormData(prev => ({ ...prev, submitted_landmark: e.target.value }))}
                        placeholder="e.g., Next to Eldoret Post Office"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Photo of the Office (Optional but Recommended)
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageSelect}
                            className="hidden"
                          />
                          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
                            <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-gray-600">
                              {imageFile ? 'Photo selected' : 'Take or upload a photo'}
                            </p>
                          </div>
                        </label>
                        {imagePreview && (
                          <div className="flex-shrink-0 w-20 h-20">
                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        📸 Photos with GPS data are prioritized for fast verification
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any landmarks, building details, or other information..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
                      />
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        required
                        checked={agreement}
                        onChange={(e) => setAgreement(e.target.checked)}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">
                        I confirm this is the correct location of an IEBC office and consent to submitting my approximate location for public benefit
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!agreement}
                      className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Review Submission
                    </button>
                  </div>
                </form>
              )}

              {/* Step 4: Submission Complete */}
              {step === 4 && (
                <div className="text-center space-y-6">
                  {submissionSuccess ? (
                    <>
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Contribution Successfully Submitted!</h3>
                        <p className="text-gray-600 mb-4">Your location data has been submitted and is now in our moderation queue.</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                        <p className="text-sm text-green-700 text-left">
                          <strong className="block mb-2">What happens next:</strong>
                          <span className="block mb-1">✓ Your submission enters our moderation queue</span>
                          <span className="block mb-1">✓ Our team will verify the location data for accuracy</span>
                          <span className="block mb-1">✓ Once approved, it will be added to the official database</span>
                          <span className="block">✓ You'll be helping thousands of Kenyans find accurate IEBC office locations</span>
                        </p>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                        <p className="text-sm text-blue-700 text-left">
                          <strong className="block mb-1">Contribution ID: #{contributionId}</strong>
                          <span>Keep this reference number for any inquiries about your submission.</span>
                        </p>
                      </div>
                      <div className="flex space-x-3 pt-2">
                        <button
                          onClick={handleClose}
                          className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                        >
                          Continue Browsing
                        </button>
                        <button
                          onClick={() => window.location.reload()}
                          className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
                        >
                          Reload Map & See Updates
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-8">
                      <LoadingSpinner size="large" />
                      <p className="text-gray-600 mt-4">Processing your contribution...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ContributeLocationModal;
