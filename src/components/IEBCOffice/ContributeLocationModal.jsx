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
import { useTheme } from '@/contexts/ThemeContext';

// Method Selection Component
const MethodSelection = ({ onSelectMethod, onClose }) => {
  const { theme } = useTheme();

  const methods = [
    {
      id: 'current-location',
      title: 'Use My Current Location',
      description: 'Stand at the IEBC office and contribute your precise GPS location',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'green'
    },
    {
      id: 'drop-pin',
      title: 'Drop a Pin on Map',
      description: 'Manually place a pin on the exact IEBC office location',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'blue'
    },
    {
      id: 'google-maps',
      title: 'Paste Google Maps Link',
      description: 'Share a Google Maps URL or coordinates',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      color: 'red'
    }
  ];

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Contribution Method</h3>
      <p className="text-gray-600 mb-6">Select how you'd like to contribute the IEBC office location</p>
      
      <div className="grid grid-cols-1 gap-4">
        {methods.map((method) => (
          <motion.button
            key={method.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectMethod(method.id)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              theme === 'dark' 
                ? 'bg-ios-dark-surface border-ios-dark-border hover:border-ios-blue-dark' 
                : 'bg-white border-gray-200 hover:border-blue-500'
            }`}
          >
            <div className="flex items-start space-x-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                method.color === 'green' ? 'bg-green-100 text-green-600' :
                method.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                'bg-red-100 text-red-600'
              }`}>
                {method.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{method.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{method.description}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
      
      <div className="flex space-x-3 mt-6">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Google Maps URL Input Component
const GoogleMapsInput = ({ onCoordinatesFound, onBack }) => {
  const [inputValue, setInputValue] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [error, setError] = useState(null);
  const { theme } = useTheme();

  const parseGoogleMapsInput = useCallback((input) => {
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
    
    // Pattern 5: Short URL
    if (trimmed.match(/goo\.gl\/maps\/|maps\.app\.goo\.gl/)) {
      return { requiresExpansion: true, shortUrl: trimmed, source: 'short_url' };
    }
    
    return null;
  }, []);

  const isValidCoordinate = useCallback((lat, lng) => {
    const KENYA_BOUNDS = {
      minLat: -4.678, maxLat: 5.506,
      minLng: 33.908, maxLng: 41.899
    };
    return (!isNaN(lat) && !isNaN(lng) &&
            lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat &&
            lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng);
  }, []);

  const expandShortUrl = useCallback(async (shortUrl) => {
    try {
      setIsExpanding(true);
      const response = await fetch('/api/expand-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: shortUrl })
      });
      
      if (!response.ok) throw new Error('Failed to expand URL');
      
      const data = await response.json();
      return parseGoogleMapsInput(data.expandedUrl);
    } catch (error) {
      console.error('Failed to expand short URL:', error);
      setError('Failed to process Google Maps link. Please paste the full URL or coordinates.');
      return null;
    } finally {
      setIsExpanding(false);
    }
  }, [parseGoogleMapsInput]);

  const handleInputChange = useCallback(async (e) => {
    const value = e.target.value;
    setInputValue(value);
    setError(null);
    
    if (!value.trim()) {
      setParseResult(null);
      return;
    }
    
    const result = parseGoogleMapsInput(value);
    
    if (result?.requiresExpansion) {
      const expanded = await expandShortUrl(result.shortUrl);
      if (expanded) {
        setParseResult(expanded);
        onCoordinatesFound(expanded);
      }
    } else if (result?.lat && result?.lng) {
      setParseResult(result);
      onCoordinatesFound(result);
    } else {
      setParseResult({ error: 'Could not extract coordinates. Please check the format.' });
    }
  }, [parseGoogleMapsInput, expandShortUrl, onCoordinatesFound]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Paste Google Maps Link</h3>
        <p className="text-gray-600">
          Paste a Google Maps URL or coordinates in format: -1.2921,36.8219
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Maps URL or Coordinates
        </label>
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder="https://maps.google.com/... or -1.2921,36.8219"
          className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            theme === 'dark' 
              ? 'bg-ios-dark-surface border-ios-dark-border text-white' 
              : 'bg-white border-gray-300 text-gray-900'
          }`}
        />
      </div>
      
      {isExpanding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <LoadingSpinner size="small" />
            <span className="text-blue-700">Expanding short URL...</span>
          </div>
        </div>
      )}
      
      {parseResult?.lat && parseResult?.lng && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-700">
              Coordinates extracted: {parseResult.lat.toFixed(6)}, {parseResult.lng.toFixed(6)}
            </span>
          </div>
        </div>
      )}
      
      {parseResult?.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-700">{parseResult.error}</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="text-red-700">{error}</div>
        </div>
      )}
      
      <div className="flex space-x-3 pt-4">
        <button
          onClick={onBack}
          className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => parseResult?.lat && onCoordinatesFound(parseResult)}
          disabled={!parseResult?.lat}
          className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

// Enhanced ContributeLocationModal Component
const ContributeLocationModal = ({ isOpen, onClose, onSuccess, userLocation }) => {
  const [step, setStep] = useState('method-selection'); // 'method-selection', 'capture', 'form', 'success'
  const [method, setMethod] = useState(null); // 'current-location', 'drop-pin', 'google-maps'
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState({
    officeName: '',
    county: '',
    constituency: '',
    landmark: '',
    notes: ''
  });
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [contributionId, setContributionId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const { theme } = useTheme();

  const { getCurrentPosition, convertImageToWebP, submitContribution } = useContributeLocation();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('method-selection');
      setMethod(null);
      setPosition(null);
      setAccuracy(null);
      setImageFile(null);
      setImagePreview(null);
      setFormData({
        officeName: '', county: '', constituency: '', landmark: '', notes: ''
      });
      setLocationError(null);
      setSubmissionSuccess(false);
      setContributionId(null);
    }
  }, [isOpen]);

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
    setIsMapReady(true);
  }, []);

  const addMarkerToMap = useCallback((position, draggable = true) => {
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
      draggable: draggable
    }).addTo(mapRef.current);
    
    if (draggable) {
      markerRef.current.on('dragend', (event) => {
        const newPosition = event.target.getLatLng();
        setPosition({ lat: newPosition.lat, lng: newPosition.lng });
        setAccuracy(5); // Manual placement has high accuracy
      });
    }
  }, []);

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

  const handleMethodSelect = useCallback((selectedMethod) => {
    setMethod(selectedMethod);
    
    if (selectedMethod === 'current-location') {
      setStep('capture');
      captureCurrentLocation();
    } else if (selectedMethod === 'drop-pin') {
      setStep('capture');
      // Map will be shown for pin dropping
    } else if (selectedMethod === 'google-maps') {
      setStep('google-maps-input');
    }
  }, []);

  const captureCurrentLocation = useCallback(async () => {
    setLocationError(null);
    
    try {
      const pos = await getCurrentPosition();
      const capturedPosition = { lat: pos.latitude, lng: pos.longitude };
      const limitedAccuracy = Math.min(pos.accuracy, 1000);
      
      setPosition(capturedPosition);
      setAccuracy(limitedAccuracy);
      
      if (mapRef.current) {
        mapRef.current.flyTo([pos.latitude, pos.longitude], 16, { duration: 1 });
        addMarkerToMap(capturedPosition);
        addAccuracyCircle(capturedPosition, limitedAccuracy);
      }
      
      // Check accuracy and show guidance
      if (limitedAccuracy > 100) {
        setLocationError(`GPS accuracy is low (±${Math.round(limitedAccuracy)}m). Please move to an open area or manually adjust the pin.`);
      }
      
    } catch (err) {
      console.error('Error capturing location:', err);
      setLocationError('Failed to get your location. Please ensure location services are enabled.');
    }
  }, [getCurrentPosition, addMarkerToMap, addAccuracyCircle]);

  const handleMapClick = useCallback((e) => {
    if (method === 'drop-pin') {
      const clickedPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPosition(clickedPosition);
      setAccuracy(5); // Manual placement has high accuracy
      
      if (mapRef.current) {
        mapRef.current.flyTo([e.latlng.lat, e.latlng.lng], 16, { duration: 0.5 });
        addMarkerToMap(clickedPosition);
        addAccuracyCircle(clickedPosition, 5);
      }
    }
  }, [method, addMarkerToMap, addAccuracyCircle]);

  const handleGoogleMapsCoordinates = useCallback((result) => {
    setPosition({ lat: result.lat, lng: result.lng });
    setAccuracy(null); // Unknown accuracy for pasted links
    setStep('capture');
    
    if (mapRef.current) {
      mapRef.current.flyTo([result.lat, result.lng], 16, { duration: 1 });
      addMarkerToMap({ lat: result.lat, lng: result.lng }, true);
    }
  }, [addMarkerToMap]);

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

  const handleFormSubmit = useCallback(async () => {
    if (!position || !formData.officeName || !formData.county || !formData.constituency) {
      setLocationError('Please fill in all required fields');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const contributionData = {
        submitted_latitude: position.lat,
        submitted_longitude: position.lng,
        submitted_accuracy_meters: accuracy,
        submitted_office_location: formData.officeName,
        submitted_county: formData.county,
        submitted_constituency: formData.constituency,
        submitted_landmark: formData.landmark,
        google_maps_link: formData.notes, // Using notes field for Google Maps link
        imageFile: imageFile,
        device_metadata: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timestamp: new Date().toISOString(),
          capture_method: method
        }
      };
      
      const result = await submitContribution(contributionData);
      setContributionId(result.id);
      setSubmissionSuccess(true);
      setStep('success');
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Submission error:', err);
      setLocationError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [position, accuracy, formData, imageFile, method, submitContribution, onSuccess]);

  const handleClose = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    onClose();
  }, [imagePreview, onClose]);

  if (!isOpen) return null;

  const renderStepContent = () => {
    switch (step) {
      case 'method-selection':
        return (
          <MethodSelection 
            onSelectMethod={handleMethodSelect}
            onClose={handleClose}
          />
        );
        
      case 'google-maps-input':
        return (
          <GoogleMapsInput
            onCoordinatesFound={handleGoogleMapsCoordinates}
            onBack={() => setStep('method-selection')}
          />
        );
        
      case 'capture':
        return (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {method === 'current-location' ? 'Confirm Your Location' : 'Place the Pin'}
              </h3>
              <p className="text-gray-600">
                {method === 'current-location' 
                  ? (accuracy ? `GPS Accuracy: ±${Math.round(accuracy)} meters` : 'Getting your location...')
                  : 'Click on the map to place the pin at the exact IEBC office location'
                }
              </p>
              {method === 'current-location' && accuracy > 100 && (
                <p className="text-yellow-600 text-sm mt-2">
                  💡 For best accuracy, stand within 20m of the office entrance in an open area
                </p>
              )}
            </div>
            
            <div className="h-64 rounded-xl overflow-hidden border border-gray-300">
              <MapContainer
                center={position ? [position.lat, position.lng] : (userLocation ? [userLocation.latitude, userLocation.longitude] : [-1.286389, 36.817223])}
                zoom={position ? 16 : 10}
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
            
            {locationError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-red-700">{locationError}</span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('method-selection')}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep('form')}
                disabled={!position}
                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue to Details
              </button>
            </div>
          </div>
        );
        
      case 'form':
        return (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Office Details</h3>
              <p className="text-gray-600">Provide information about the IEBC office</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Office Name *
                </label>
                <input
                  type="text"
                  value={formData.officeName}
                  onChange={(e) => setFormData(prev => ({ ...prev, officeName: e.target.value }))}
                  placeholder="e.g., IEBC Eldoret County Office"
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-ios-dark-surface border-ios-dark-border text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  County *
                </label>
                <input
                  type="text"
                  value={formData.county}
                  onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))}
                  placeholder="e.g., Uasin Gishu"
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-ios-dark-surface border-ios-dark-border text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Constituency *
                </label>
                <input
                  type="text"
                  value={formData.constituency}
                  onChange={(e) => setFormData(prev => ({ ...prev, constituency: e.target.value }))}
                  placeholder="e.g., Turbo Constituency"
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-ios-dark-surface border-ios-dark-border text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nearby Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={formData.landmark}
                  onChange={(e) => setFormData(prev => ({ ...prev, landmark: e.target.value }))}
                  placeholder="e.g., Next to Eldoret Post Office"
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    theme === 'dark' 
                      ? 'bg-ios-dark-surface border-ios-dark-border text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo of Office (Optional)
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
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                      theme === 'dark'
                        ? 'border-ios-dark-border hover:border-ios-blue-dark'
                        : 'border-gray-300 hover:border-blue-500'
                    }`}>
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
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {locationError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm text-red-700">{locationError}</p>
              </div>
            )}
            
            <div className="flex space-x-3">
              <button
                onClick={() => setStep('capture')}
                className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="small" className="mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit Contribution'
                )}
              </button>
            </div>
          </div>
        );
        
      case 'success':
        return (
          <div className="p-6 text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Contribution Submitted!</h3>
              <p className="text-gray-600 mb-4">
                Your IEBC office location has been submitted and is now in our moderation queue.
              </p>
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
            
            {contributionId && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm text-blue-700 text-left">
                  <strong className="block mb-1">Contribution ID: #{contributionId}</strong>
                  <span>Keep this reference number for any inquiries about your submission.</span>
                </p>
              </div>
            )}
            
            <div className="flex space-x-3">
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
          </div>
        );
        
      default:
        return null;
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col"
      >
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 'method-selection' && 'Contribute IEBC Office Location'}
            {step === 'google-maps-input' && 'Paste Google Maps Link'}
            {step === 'capture' && (method === 'current-location' ? 'Confirm Location' : 'Place Pin on Map')}
            {step === 'form' && 'Office Details'}
            {step === 'success' && 'Submission Complete'}
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
        
        <div className="flex-1 overflow-y-auto">
          {renderStepContent()}
        </div>
      </motion.div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && modalContent}
    </AnimatePresence>,
    document.body
  );
};

export default ContributeLocationModal;
