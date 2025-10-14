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

const ContributeLocationModal = ({ isOpen, onClose, onSuccess, userLocation }) => {
  const [step, setStep] = useState(1);
  const [position, setPosition] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [selectedOffice, setSelectedOffice] = useState(null);
  const [nearbyOffices, setNearbyOffices] = useState([]);
  const [useTriangulation, setUseTriangulation] = useState(true);
  const [agreement, setAgreement] = useState(false);
  const [mapCenter, setMapCenter] = useState([-1.286389, 36.817223]);
  const [mapZoom, setMapZoom] = useState(6);
  const [isMapReady, setIsMapReady] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [contributionId, setContributionId] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [initialPosition, setInitialPosition] = useState(null);
  const [initialAccuracy, setInitialAccuracy] = useState(null);
  const [hasRecordedInitial, setHasRecordedInitial] = useState(false);
  
  const mapRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const markerRef = useRef(null);
  const geoJSONManagerRef = useRef(null);

  const {
    getCurrentPosition,
    convertImageToWebP,
    findNearbyLandmarks,
    calculateWeightedPosition,
    submitContribution,
    isSubmitting,
    error
  } = useContributeLocation();

  const recordInitialCapture = useCallback(async (capturedPosition, capturedAccuracy) => {
    try {
      if (hasRecordedInitial) return;

      const initialContributionData = {
        latitude: capturedPosition.lat,
        longitude: capturedPosition.lng,
        accuracy: capturedAccuracy,
        status: 'initial_capture',
        device_metadata: {
          user_agent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timestamp: new Date().toISOString(),
          capture_type: 'initial'
        },
        submitted_timestamp: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .insert(initialContributionData)
        .select()
        .single();

      if (error) {
        console.error('Error recording initial capture:', error);
        return;
      }

      console.log('Initial capture recorded with ID:', data.id);
      setHasRecordedInitial(true);
    } catch (err) {
      console.error('Failed to record initial capture:', err);
    }
  }, [hasRecordedInitial]);

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
      html: `
        <div style="
          width: 24px;
          height: 24px;
          background: #34C759;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 8px;
            height: 8px;
            background: white;
            border-radius: 50%;
          "></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    markerRef.current = L.marker([position.lat, position.lng], { 
      icon: customIcon,
      draggable: true 
    }).addTo(mapRef.current);

    markerRef.current.on('dragend', (event) => {
      const newPosition = event.target.getLatLng();
      setPosition({ lat: newPosition.lat, lng: newPosition.lng });
      setAccuracy(5);
    });
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

  const initializeMapWithUserLocation = useCallback(() => {
    if (userLocation?.latitude && userLocation?.longitude) {
      const userPos = { lat: userLocation.latitude, lng: userLocation.longitude };
      setPosition(userPos);
      setAccuracy(Math.min(userLocation.accuracy, 1000));
      setMapCenter([userLocation.latitude, userLocation.longitude]);
      setMapZoom(16);
      
      if (mapRef.current) {
        mapRef.current.flyTo([userLocation.latitude, userLocation.longitude], 16, {
          duration: 1
        });
        addMarkerToMap(userPos);
        addAccuracyCircle(userPos, Math.min(userLocation.accuracy, 1000));
      }
    }
  }, [userLocation, addMarkerToMap, addAccuracyCircle]);

  useEffect(() => {
    if (isOpen && isMapReady) {
      initializeMapWithUserLocation();
    }
  }, [isOpen, isMapReady, initializeMapWithUserLocation]);

  const captureLocation = useCallback(async () => {
    setLocationError(null);
    setHasRecordedInitial(false);

    console.log({
      getCurrentPosition: typeof getCurrentPosition,
      findNearbyLandmarks: typeof findNearbyLandmarks,
      calculateWeightedPosition: typeof calculateWeightedPosition
    });
    
    try {
      const pos = await getCurrentPosition();
      const capturedPosition = { lat: pos.latitude, lng: pos.longitude };
      const limitedAccuracy = Math.min(pos.accuracy, 1000);
      
      setPosition(capturedPosition);
      setAccuracy(limitedAccuracy);
      setInitialPosition(capturedPosition);
      setInitialAccuracy(limitedAccuracy);
      setMapCenter([pos.latitude, pos.longitude]);
      setMapZoom(16);

      if (mapRef.current) {
        mapRef.current.flyTo([pos.latitude, pos.longitude], 16, {
          duration: 1
        });
        addMarkerToMap(capturedPosition);
        addAccuracyCircle(capturedPosition, limitedAccuracy);
      }
      
      await recordInitialCapture(capturedPosition, limitedAccuracy);
      
      if (useTriangulation) {
        const landmarks = await findNearbyLandmarks(pos.latitude, pos.longitude);
        setNearbyOffices(landmarks);
        
        if (landmarks.length > 0) {
          const triangulationPoints = [
            { latitude: pos.latitude, longitude: pos.longitude, accuracy: limitedAccuracy },
            ...landmarks.map(l => ({ latitude: l.latitude, longitude: l.longitude, accuracy: 10 }))
          ];
          
          const improvedPosition = calculateWeightedPosition(triangulationPoints);
          if (improvedPosition) {
            const improvedPos = { lat: improvedPosition.latitude, lng: improvedPosition.longitude };
            setPosition(improvedPos);
            
            if (mapRef.current) {
              mapRef.current.flyTo([improvedPosition.latitude, improvedPosition.longitude], 16, {
                duration: 1
              });
              addMarkerToMap(improvedPos);
              addAccuracyCircle(improvedPos, limitedAccuracy);
            }
          }
        }
      }
      
      setStep(2);
    } catch (err) {
      console.error('Error capturing location:', err);
      setLocationError(err.message);
      
      if (mapRef.current) {
        const defaultCenter = userLocation ? 
          [userLocation.latitude, userLocation.longitude] : 
          [-1.286389, 36.817223];
        mapRef.current.flyTo(defaultCenter, 10, { duration: 1 });
      }
    }
  }, [
    getCurrentPosition, 
    findNearbyLandmarks, 
    calculateWeightedPosition, 
    useTriangulation, 
    userLocation,
    addMarkerToMap,
    addAccuracyCircle,
    recordInitialCapture
  ]);

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

  const handleMapClick = useCallback((e) => {
    const clickedPosition = { lat: e.latlng.lat, lng: e.latlng.lng };
    setPosition(clickedPosition);
    setAccuracy(100);
    
    if (mapRef.current) {
      mapRef.current.flyTo([e.latlng.lat, e.latlng.lng], 16, {
        duration: 0.5
      });
      addMarkerToMap(clickedPosition);
      addAccuracyCircle(clickedPosition, 100);
    }
  }, [addMarkerToMap, addAccuracyCircle]);

  const handleSubmit = useCallback(async () => {
    if (!position || !agreement) return;

    try {
      const contributionData = {
        latitude: position.lat,
        longitude: position.lng,
        accuracy: accuracy,
        officeId: selectedOffice?.id,
        officeLocation: selectedOffice?.office_location,
        county: selectedOffice?.county,
        constituency: selectedOffice?.constituency_name,
        constituencyCode: selectedOffice?.constituency_code,
        landmark: notes,
        nearbyLandmarks: nearbyOffices,
        imageFile: imageFile,
        timestamp: Date.now()
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
  }, [
    position, 
    accuracy, 
    selectedOffice, 
    notes, 
    nearbyOffices, 
    imageFile, 
    agreement, 
    submitContribution, 
    onSuccess
  ]);

  const handleHardReload = useCallback(() => {
    if (window.location.href.indexOf('?') > -1) {
      window.location.href = window.location.href.split('?')[0] + '?contribution_success=' + contributionId + '&t=' + Date.now();
    } else {
      window.location.href = window.location.href + '?contribution_success=' + contributionId + '&t=' + Date.now();
    }
  }, [contributionId]);

  const handleSuccessModalClose = useCallback(() => {
    setShowSuccessModal(false);
    handleHardReload();
  }, [handleHardReload]);

  const resetForm = useCallback(() => {
    setStep(1);
    setPosition(null);
    setAccuracy(null);
    setImageFile(null);
    setImagePreview(null);
    setNotes('');
    setSelectedOffice(null);
    setNearbyOffices([]);
    setAgreement(false);
    setLocationError(null);
    setMapCenter([-1.286389, 36.817223]);
    setMapZoom(6);
    setIsMapReady(false);
    setSubmissionSuccess(false);
    setContributionId(null);
    setShowSuccessModal(false);
    setInitialPosition(null);
    setInitialAccuracy(null);
    setHasRecordedInitial(false);

    if (markerRef.current && mapRef.current) {
      mapRef.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    
    if (accuracyCircleRef.current && mapRef.current) {
      mapRef.current.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }
    
    if (mapRef.current) {
      mapRef.current = null;
    }

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

  useEffect(() => {
    if (submissionSuccess && step === 4) {
      const timer = setTimeout(() => {
        setShowSuccessModal(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [submissionSuccess, step]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[var(--z-index-max)] flex items-center justify-center p-4 bg-black bg-opacity-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col"
        style={{ zIndex: 'var(--z-index-max)' }}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 1 && 'Contribute Location'}
            {step === 2 && 'Confirm Location'}
            {step === 3 && 'Additional Information'}
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

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Help Improve IEBC Office Locations
                </h3>
                <p className="text-gray-600 mb-4">
                  Contribute accurate location data for IEBC offices. Your submission will help others find polling stations more easily.
                </p>
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
                    <p>We only collect location data pertaining to IEBC offices made public. No personal information is stored. All submissions are moderated before being published.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={useTriangulation}
                    onChange={(e) => setUseTriangulation(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    Use advanced location accuracy (recommended)
                  </span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={agreement}
                    onChange={(e) => setAgreement(e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to contribute anonymous location data for public benefit
                  </span>
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={captureLocation}
                  disabled={!agreement}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Capture Location
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Confirm the Location
                </h3>
                <p className="text-gray-600">
                  {accuracy ? `Accuracy: ±${Math.round(accuracy)} meters` : 'Tap on the map to place the marker'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Drag the marker to adjust the exact location
                </p>
              </div>

              <div className="h-96 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
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

              {nearbyOffices.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Nearby IEBC Offices Found:
                  </p>
                  <div className="space-y-2">
                    {nearbyOffices.slice(0, 3).map((office) => (
                      <div key={office.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">{office.name}</span>
                        <span className="text-gray-500">{Math.round(office.distance_m)}m away</span>
                      </div>
                    ))}
                  </div>
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
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Additional Information
                </h3>
                <p className="text-gray-600">
                  Add a photo or notes to help verify the location (optional)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photo of the Office
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
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any landmarks, building details, or other information..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
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
          )}

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
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Contribution Successfully Submitted!
                    </h3>
                    <p className="text-gray-600 mb-4">
                      Your location data has been successfully submitted and is now in our moderation queue.
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
                      onClick={handleHardReload}
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
  );

  const successModalContent = showSuccessModal && (
    <div className="fixed inset-0 z-[calc(var(--z-index-max)+1)] flex items-center justify-center p-4 bg-black bg-opacity-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-auto p-6 text-center"
        style={{ zIndex: 'calc(var(--z-index-max) + 1)' }}
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Thank You for Your Contribution!
        </h3>
        
        <p className="text-gray-600 mb-4">
          Your IEBC office location data has been successfully submitted and will be reviewed by our moderation team.
        </p>

        <div className="bg-green-50 rounded-lg p-4 mb-4 text-left">
          <p className="text-sm text-green-700">
            <strong>Next Steps:</strong><br />
            • Submission enters moderation queue<br />
            • Team verifies location accuracy<br />
            • Approved data added to database<br />
            • Helps improve civic infrastructure
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-700">
            <strong>Reference:</strong> Contribution #{contributionId}
          </p>
        </div>

        <button
          onClick={handleSuccessModalClose}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors"
        >
          Reload Map & Continue
        </button>
      </motion.div>
    </div>
  );

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && modalContent}
      </AnimatePresence>
      <AnimatePresence>
        {successModalContent}
      </AnimatePresence>
    </>,
    document.body
  );
};

export default ContributeLocationModal;
