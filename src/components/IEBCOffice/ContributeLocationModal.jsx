// src/components/IEBCOffice/ContributeLocationModal.jsx
import React, { useState, useCallback, useEffect, useRef, useMemo, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useContributeLocation } from '@/hooks/useContributeLocation';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';

// Lazy load heavy components
const MapContainer = lazy(() => import('./MapContainer'));
const GeoJSONLayerManager = lazy(() => import('./GeoJSONLayerManager'));
const UserLocationMarker = lazy(() => import('./UserLocationMarker'));

// Move static data outside component to prevent re-creation
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

const CONSTITUENCY_SUGGESTIONS = {
  "Nairobi": ["Westlands", "Dagoretti North", "Dagoretti South", "Langata", "Kibra", "Roysambu", "Kasarani", "Ruaraka", "Embakasi South", "Embakasi North", "Embakasi Central", "Embakasi East", "Embakasi West", "Makadara", "Kamukunji", "Starehe", "Mathare"],
  "Mombasa": ["Changamwe", "Jomvu", "Kisauni", "Nyali", "Likoni", "Mvita"],
  "Kisumu": ["Kisumu East", "Kisumu West", "Kisumu Central", "Seme", "Nyando", "Muhoroni", "Nyakach"],
  "Nakuru": ["Nakuru Town East", "Nakuru Town West", "Naivasha", "Gilgil", "Bahati", "Subukia", "Rongai", "Njoro", "Molo", "Kuresoi North", "Kuresoi South"]
};

// Memoized utility functions
const isValidCoordinate = (lat, lng) => {
  const KENYA_BOUNDS = {
    minLat: -4.678, maxLat: 5.506,
    minLng: 33.908, maxLng: 41.899
  };
  
  return (!isNaN(lat) && !isNaN(lng) &&
          lat >= KENYA_BOUNDS.minLat && lat <= KENYA_BOUNDS.maxLat &&
          lng >= KENYA_BOUNDS.minLng && lng <= KENYA_BOUNDS.maxLng);
};

const parseGoogleMapsInput = (input) => {
  if (!input || typeof input !== 'string') return null;
  
  const trimmed = input.trim();
  
  // Direct coordinates
  const directCoords = trimmed.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
  if (directCoords) {
    const lat = parseFloat(directCoords[1]);
    const lng = parseFloat(directCoords[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'direct_paste' };
    }
  }
  
  // @lat,lng format
  const atPattern = trimmed.match(/@(-?\d+\.?\d+),(-?\d+\.?\d+),?(\d+\.?\d*)?z?/);
  if (atPattern) {
    const lat = parseFloat(atPattern[1]);
    const lng = parseFloat(atPattern[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, source: 'at_pattern', zoom: parseFloat(atPattern[3]) };
    }
  }
  
  return null;
};

const ContributeLocationModal = ({ isOpen, onClose, onSuccess, userLocation }) => {
  // State declarations - keep only essential state
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
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [formData, setFormData] = useState({
    submitted_office_location: '',
    submitted_county: '',
    submitted_constituency: '',
    submitted_landmark: ''
  });
  
  const [agreement, setAgreement] = useState(false);
  const [mapCenter] = useState([-1.286389, 36.817223]); // Made constant
  const [mapZoom, setMapZoom] = useState(6);
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [contributionId, setContributionId] = useState(null);
  const [duplicateOffices, setDuplicateOffices] = useState([]);
  
  const mapRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const markerRef = useRef(null);
  const fileInputRef = useRef(null);
  const duplicateCheckTimeoutRef = useRef(null);
  
  const { getCurrentPosition, convertImageToWebP, submitContribution, isSubmitting, error } = useContributeLocation();

  // Memoized values
  const constituencySuggestions = useMemo(() => {
    return CONSTITUENCY_SUGGESTIONS[formData.submitted_county] || [];
  }, [formData.submitted_county]);

  // Optimized duplicate office check with debouncing
  const safeFindDuplicateOffices = useCallback(async (lat, lng, name, radius = 200) => {
    try {
      if (typeof lat !== 'number' || typeof lng !== 'number') {
        return [];
      }
      
      const { data, error } = await supabase.rpc('find_duplicate_offices', {
        p_lat: lat,
        p_lng: lng,
        p_name: String(name || ''),
        p_radius_meters: Math.max(50, Math.min(radius, 1000))
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn('Duplicate check failed:', error.message);
      return [];
    }
  }, []);

  // Optimized marker and circle functions with minimal dependencies
  const addMarkerToMap = useCallback((position, method = selectedMethod) => {
    if (!mapRef.current || !position?.lat || !position?.lng) return;

    try {
      if (markerRef.current) {
        mapRef.current.removeLayer(markerRef.current);
      }
      
      // Simple marker without complex icons for performance
      markerRef.current = L.marker([position.lat, position.lng], {
        draggable: method === 'drop_pin'
      }).addTo(mapRef.current);
      
      if (method === 'drop_pin') {
        markerRef.current.on('dragend', (event) => {
          const newPosition = event.target.getLatLng();
          setPosition({ lat: newPosition.lat, lng: newPosition.lng });
          setAccuracy(5);
        });
      }
    } catch (error) {
      console.error('Error adding marker:', error);
    }
  }, [selectedMethod]);

  const addAccuracyCircle = useCallback((position, accuracyValue) => {
    if (!mapRef.current || !position?.lat || !position?.lng || !accuracyValue) return;

    try {
      if (accuracyCircleRef.current) {
        mapRef.current.removeLayer(accuracyCircleRef.current);
      }
      
      const limitedAccuracy = Math.min(accuracyValue, 1000);
      accuracyCircleRef.current = L.circle([position.lat, position.lng], {
        radius: limitedAccuracy,
        color: '#34C759',
        fillColor: '#34C759',
        fillOpacity: 0.1,
        weight: 2,
        opacity: 0.6
      }).addTo(mapRef.current);
    } catch (error) {
      console.error('Error adding accuracy circle:', error);
    }
  }, []);

  // Optimized handlers
  const handleMapClick = useCallback((e) => {
    if (selectedMethod === 'drop_pin' && e?.latlng) {
      const { lat, lng } = e.latlng;
      const clickedPosition = { lat, lng };
      
      setPosition(clickedPosition);
      setAccuracy(5);
      
      if (mapRef.current?.isReady?.()) {
        mapRef.current.flyTo([lat, lng], 16, { duration: 0.5 });
        addMarkerToMap(clickedPosition, 'drop_pin');
        addAccuracyCircle(clickedPosition, 5);
      }
    }
  }, [selectedMethod, addMarkerToMap, addAccuracyCircle]);

  const handleMapReady = useCallback((map) => {
    setIsMapReady(true);
    
    if (map) {
      map.on('click', handleMapClick);
    }
    
    // Only add layers if we have a position
    if (position) {
      setTimeout(() => {
        addMarkerToMap(position);
        addAccuracyCircle(position, accuracy);
      }, 100);
    }
  }, [position, accuracy, handleMapClick, addMarkerToMap, addAccuracyCircle]);

  // Optimized useEffect with proper cleanup
  useEffect(() => {
    if (!position || !formData.submitted_office_location) return;

    // Clear any existing timeout
    if (duplicateCheckTimeoutRef.current) {
      clearTimeout(duplicateCheckTimeoutRef.current);
    }

    // Debounced duplicate check
    duplicateCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await safeFindDuplicateOffices(
          position.lat, 
          position.lng, 
          formData.submitted_office_location, 
          200
        );
        setDuplicateOffices(results.filter(office => office.is_likely_duplicate === true));
      } catch (error) {
        console.error('Duplicate check failed:', error);
        setDuplicateOffices([]);
      }
    }, 800);

    return () => {
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
    };
  }, [position, formData.submitted_office_location, safeFindDuplicateOffices]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup timeouts
      if (duplicateCheckTimeoutRef.current) {
        clearTimeout(duplicateCheckTimeoutRef.current);
      }
      
      // Cleanup image preview
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
      
      // Cleanup map layers if map is available
      if (mapRef.current) {
        try {
          if (markerRef.current) {
            mapRef.current.removeLayer(markerRef.current);
          }
          if (accuracyCircleRef.current) {
            mapRef.current.removeLayer(accuracyCircleRef.current);
          }
        } catch (error) {
          console.warn('Error during map cleanup:', error);
        }
      }
    };
  }, [imagePreview]);

  // Method handlers
  const handleMethodSelect = useCallback((method) => {
    setSelectedMethod(method);
    setStep(2);
    
    if (method === 'current_location') {
      handleCurrentLocation();
    }
  }, []);

  const handleCurrentLocation = async () => {
    setLocationError(null);
    setIsGettingLocation(true);
    
    try {
      const pos = await getCurrentPosition();
      
      if (!pos?.latitude || !pos?.longitude) {
        throw new Error('Failed to retrieve valid location data');
      }

      const { latitude, longitude, accuracy: posAccuracy = 50 } = pos;
      const capturedPosition = { lat: latitude, lng: longitude };
      const limitedAccuracy = Math.min(posAccuracy, 1000);
      
      setPosition(capturedPosition);
      setAccuracy(limitedAccuracy);
      setMapZoom(16);
      
      if (mapRef.current?.isReady?.()) {
        mapRef.current.flyTo([latitude, longitude], 16, { 
          duration: 1 
        }, () => {
          setTimeout(() => {
            addMarkerToMap(capturedPosition);
            addAccuracyCircle(capturedPosition, limitedAccuracy);
          }, 300);
        });
      }
    } catch (err) {
      console.error('Error capturing location:', err);
      setLocationError({
        type: 'error',
        message: err?.message || 'Failed to get current location',
        action: {
          label: 'Try Drop Pin Method',
          onClick: () => setSelectedMethod('drop_pin')
        }
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleGoogleMapsParse = async () => {
    if (!googleMapsInput.trim()) return;
    
    setIsExpandingUrl(true);
    setLocationError(null);
    
    try {
      const result = parseGoogleMapsInput(googleMapsInput);
      
      if (result?.lat && result?.lng) {
        setParseResult(result);
        setPosition({ lat: result.lat, lng: result.lng });
        setMapZoom(16);
        
        if (mapRef.current?.isReady?.()) {
          mapRef.current.flyTo([result.lat, result.lng], 16, { 
            duration: 1 
          }, () => {
            setTimeout(() => {
              addMarkerToMap({ lat: result.lat, lng: result.lng });
              addAccuracyCircle({ lat: result.lat, lng: result.lng }, 5);
            }, 300);
          });
        }
      } else {
        setLocationError({
          type: 'error',
          message: 'Could not parse input. Please check the format and try again.'
        });
      }
    } catch (err) {
      console.error('Error parsing Google Maps input:', err);
      setLocationError({
        type: 'error',
        message: 'Failed to process the Google Maps link'
      });
    } finally {
      setIsExpandingUrl(false);
    }
  };

  const handleImageSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Image must be smaller than 10MB');
      }
      
      const webpFile = await convertImageToWebP(file);
      setImageFile(webpFile);
      
      const previewUrl = URL.createObjectURL(webpFile);
      setImagePreview(previewUrl);
    } catch (err) {
      setLocationError({
        type: 'error',
        message: err.message
      });
    }
  }, [convertImageToWebP]);

  const handleRemoveImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [imagePreview]);

  const handleFinalSubmit = async () => {
    if (!position || !agreement) {
      setLocationError({
        type: 'error',
        message: 'Please confirm your agreement and ensure location is set.'
      });
      return;
    }
    
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
          timestamp: new Date().toISOString(),
          capture_method: selectedMethod,
          accuracy: accuracy,
          duplicate_count: duplicateOffices.length
        }
      };
      
      const result = await submitContribution(contributionData);
      setContributionId(result.id);
      setSubmissionSuccess(true);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      setStep(4);
    } catch (err) {
      setLocationError({
        type: 'error',
        message: err.message || 'Failed to submit contribution'
      });
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
    setDuplicateOffices([]);
    
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  // Memoized form handlers
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleFormSubmit = useCallback((e) => {
    e.preventDefault();
    handleFinalSubmit();
  }, [handleFinalSubmit]);

  // Don't render if not open
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
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  {step === 1 && 'Contribute IEBC Office Location'}
                  {step === 2 && 'Capture Location'}
                  {step === 3 && 'Office Details'}
                  {step === 4 && 'Submission Complete'}
                </h2>
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4].map((stepNum) => (
                    <div
                      key={stepNum}
                      className={`w-2 h-2 rounded-full ${
                        stepNum === step ? 'bg-green-600' : 
                        stepNum < step ? 'bg-green-400' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
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
                <div className={`mb-4 border rounded-xl p-4 ${
                  locationError.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
                  locationError.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                  locationError.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{locationError.message}</p>
                      {locationError.action && (
                        <button
                          onClick={locationError.action.onClick}
                          className="mt-2 text-sm font-medium underline hover:no-underline"
                        >
                          {locationError.action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Step Content */}
              {step === 1 && (
                <MethodSelectionStep onMethodSelect={handleMethodSelect} />
              )}

              {step === 2 && (
                <LocationCaptureStep
                  selectedMethod={selectedMethod}
                  position={position}
                  accuracy={accuracy}
                  isGettingLocation={isGettingLocation}
                  googleMapsInput={googleMapsInput}
                  setGoogleMapsInput={setGoogleMapsInput}
                  parseResult={parseResult}
                  isExpandingUrl={isExpandingUrl}
                  onGoogleMapsParse={handleGoogleMapsParse}
                  onBack={() => setStep(1)}
                  onContinue={() => setStep(3)}
                  mapCenter={mapCenter}
                  mapZoom={mapZoom}
                  onMapReady={handleMapReady}
                  userLocation={userLocation}
                  duplicateOffices={duplicateOffices}
                />
              )}

              {step === 3 && (
                <OfficeDetailsStep
                  formData={formData}
                  onFormDataChange={handleInputChange}
                  notes={notes}
                  setNotes={setNotes}
                  imagePreview={imagePreview}
                  onImageSelect={handleImageSelect}
                  onRemoveImage={handleRemoveImage}
                  agreement={agreement}
                  setAgreement={setAgreement}
                  constituencySuggestions={constituencySuggestions}
                  onBack={() => setStep(2)}
                  onSubmit={handleFormSubmit}
                  isSubmitting={isSubmitting}
                  fileInputRef={fileInputRef}
                />
              )}

              {step === 4 && (
                <SubmissionCompleteStep
                  submissionSuccess={submissionSuccess}
                  contributionId={contributionId}
                  onClose={handleClose}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// Extracted step components for better performance
const MethodSelectionStep = React.memo(({ onMethodSelect }) => (
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
      <MethodButton
        icon="current_location"
        title="Use My Current Location"
        description="Stand at the IEBC office and capture your GPS coordinates"
        badge="✓ Most accurate method"
        onClick={() => onMethodSelect('current_location')}
      />
      <MethodButton
        icon="drop_pin"
        title="Drop a Pin on Map"
        description="Manually place a pin on the exact office location"
        badge="✓ Good for precise placement"
        onClick={() => onMethodSelect('drop_pin')}
      />
      <MethodButton
        icon="google_maps"
        title="Paste Google Maps Link"
        description="Share a Google Maps URL or coordinates"
        badge="✓ Quick and convenient"
        onClick={() => onMethodSelect('google_maps')}
      />
    </div>

    <div className="bg-green-50 rounded-lg p-4">
      <div className="flex items-start space-x-3">
        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-green-700">
          <p className="font-medium">Privacy Notice</p>
          <p>We only collect location data pertaining to IEBC offices for public benefit. No personal information is stored.</p>
        </div>
      </div>
    </div>
  </div>
));

const MethodButton = React.memo(({ icon, title, description, badge, onClick }) => {
  const getIcon = () => {
    switch (icon) {
      case 'current_location':
        return (
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'drop_pin':
        return (
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
        );
      case 'google_maps':
        return (
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColorClass = () => {
    switch (icon) {
      case 'current_location': return 'hover:border-green-500 hover:bg-green-50 focus:ring-green-500';
      case 'drop_pin': return 'hover:border-blue-500 hover:bg-blue-50 focus:ring-blue-500';
      case 'google_maps': return 'hover:border-red-500 hover:bg-red-50 focus:ring-red-500';
      default: return 'hover:border-gray-500 hover:bg-gray-50 focus:ring-gray-500';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 border-2 border-gray-200 rounded-xl transition-all text-left focus:outline-none focus:ring-2 focus:ring-offset-2 ${getColorClass()}`}
    >
      <div className="flex items-center space-x-3">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
          icon === 'current_location' ? 'bg-green-100' :
          icon === 'drop_pin' ? 'bg-blue-100' :
          'bg-red-100'
        }`}>
          {getIcon()}
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-600">{description}</p>
          <p className={`text-xs mt-1 ${
            icon === 'current_location' ? 'text-green-600' :
            icon === 'drop_pin' ? 'text-blue-600' :
            'text-red-600'
          }`}>{badge}</p>
        </div>
      </div>
    </button>
  );
});

const LocationCaptureStep = React.memo(({
  selectedMethod,
  position,
  accuracy,
  isGettingLocation,
  googleMapsInput,
  setGoogleMapsInput,
  parseResult,
  isExpandingUrl,
  onGoogleMapsParse,
  onBack,
  onContinue,
  mapCenter,
  mapZoom,
  onMapReady,
  userLocation,
  duplicateOffices
}) => (
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
            onClick={onGoogleMapsParse}
            disabled={!googleMapsInput.trim() || isExpandingUrl}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isExpandingUrl ? (
              <div className="flex items-center space-x-2">
                <LoadingSpinner size="small" />
                <span>Processing...</span>
              </div>
            ) : (
              'Parse'
            )}
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

    {/* Map Preview - Lazy loaded */}
    {(selectedMethod === 'current_location' || selectedMethod === 'drop_pin' || parseResult) && (
      <div className="h-64 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
        <Suspense fallback={<div className="h-full w-full flex items-center justify-center">Loading map...</div>}>
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="h-full w-full"
            onMapReady={onMapReady}
            isModalMap={true}
          >
            <GeoJSONLayerManager
              activeLayers={['iebc-offices']}
              isModalMap={true}
            />
            {userLocation && (
              <UserLocationMarker
                position={[userLocation.latitude, userLocation.longitude]}
                accuracy={Math.min(userLocation.accuracy, 1000)}
              />
            )}
          </MapContainer>
        </Suspense>
      </div>
    )}

    {duplicateOffices.length > 0 && (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800 mb-1">
              Possible duplicate office detected
            </p>
            <p className="text-sm text-yellow-700">
              There {duplicateOffices.length === 1 ? 'is' : 'are'} {duplicateOffices.length} verified office{duplicateOffices.length === 1 ? '' : 's'} within 100m.
            </p>
          </div>
        </div>
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
        onClick={onContinue}
        disabled={!position || isGettingLocation}
        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isGettingLocation ? (
          <div className="flex items-center justify-center space-x-2">
            <LoadingSpinner size="small" />
            <span>Getting Location...</span>
          </div>
        ) : (
          'Continue to Details'
        )}
      </button>
    </div>
  </div>
));

const OfficeDetailsStep = React.memo(({
  formData,
  onFormDataChange,
  notes,
  setNotes,
  imagePreview,
  onImageSelect,
  onRemoveImage,
  agreement,
  setAgreement,
  constituencySuggestions,
  onBack,
  onSubmit,
  isSubmitting,
  fileInputRef
}) => (
  <form onSubmit={onSubmit} className="space-y-6">
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Office Information</h3>
      <p className="text-gray-600">Provide details about the IEBC office</p>
    </div>

    <div className="grid grid-cols-1 gap-4">
      <div>
        <label htmlFor="office-name" className="block text-sm font-medium text-gray-700 mb-1">
          Office Name *
        </label>
        <input
          id="office-name"
          type="text"
          required
          value={formData.submitted_office_location}
          onChange={(e) => onFormDataChange('submitted_office_location', e.target.value)}
          placeholder="e.g., IEBC Eldoret County Office"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="county" className="block text-sm font-medium text-gray-700 mb-1">
            County *
          </label>
          <select
            id="county"
            required
            value={formData.submitted_county}
            onChange={(e) => onFormDataChange('submitted_county', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
          >
            <option value="">Select County</option>
            {KENYAN_COUNTIES.map(county => (
              <option key={county} value={county}>{county}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="constituency" className="block text-sm font-medium text-gray-700 mb-1">
            Constituency *
          </label>
          <input
            id="constituency"
            type="text"
            required
            value={formData.submitted_constituency}
            onChange={(e) => onFormDataChange('submitted_constituency', e.target.value)}
            placeholder="e.g., Embakasi West"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
            list="constituency-suggestions"
          />
          <datalist id="constituency-suggestions">
            {constituencySuggestions.map(constituency => (
              <option key={constituency} value={constituency} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-1">
          Nearby Landmark (Optional)
        </label>
        <input
          id="landmark"
          type="text"
          value={formData.submitted_landmark}
          onChange={(e) => onFormDataChange('submitted_landmark', e.target.value)}
          placeholder="e.g., Next to Eldoret Post Office"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Photo of the Office (Optional)
        </label>
        <div className="flex items-center space-x-4">
          <label className="flex-1 cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onImageSelect}
              className="hidden"
            />
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-600">
                {imagePreview ? 'Photo selected' : 'Take or upload a photo'}
              </p>
            </div>
          </label>
          {imagePreview && (
            <div className="flex-shrink-0 relative">
              <img src={imagePreview} alt="Office preview" className="w-20 h-20 object-cover rounded-lg" />
              <button
                type="button"
                onClick={onRemoveImage}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Additional Notes (Optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any landmarks, building details, or other information..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-green-500 focus:border-green-500"
        />
      </div>

      <div className="flex items-start space-x-3">
        <input
          id="agreement"
          type="checkbox"
          required
          checked={agreement}
          onChange={(e) => setAgreement(e.target.checked)}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500 mt-1"
        />
        <label htmlFor="agreement" className="text-sm text-gray-700">
          I confirm this is the correct location of an IEBC office
        </label>
      </div>
    </div>

    <div className="flex space-x-3 pt-4">
      <button
        type="button"
        onClick={onBack}
        className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
      >
        Back
      </button>
      <button
        type="submit"
        disabled={!agreement || isSubmitting}
        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center space-x-2">
            <LoadingSpinner size="small" />
            <span>Submitting...</span>
          </div>
        ) : (
          'Submit Contribution'
        )}
      </button>
    </div>
  </form>
));

const SubmissionCompleteStep = React.memo(({ submissionSuccess, contributionId, onClose }) => (
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
          <p className="text-gray-600 mb-4">Your location data has been submitted for moderation.</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-700 text-left">
            <strong className="block mb-2">What happens next:</strong>
            <span className="block mb-1">✓ Your submission enters our moderation queue</span>
            <span className="block mb-1">✓ Our team will verify the location data</span>
            <span className="block">✓ Once approved, it will be added to the official database</span>
          </p>
        </div>
        {contributionId && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm text-blue-700 text-left">
              <strong className="block mb-1">Contribution ID: #{contributionId}</strong>
              <span>Keep this reference number for any inquiries.</span>
            </p>
          </div>
        )}
        <div className="flex space-x-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Continue Browsing
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
));

export default ContributeLocationModal;
