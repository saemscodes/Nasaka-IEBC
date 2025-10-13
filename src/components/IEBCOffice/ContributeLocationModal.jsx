import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useContributeLocation } from '@/hooks/useContributeLocation';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { supabase } from '@/integrations/supabase/client';

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
  
  const {
    getCurrentPosition,
    convertImageToWebP,
    findNearbyLandmarks,
    calculateWeightedPosition,
    submitContribution,
    isSubmitting,
    error
  } = useContributeLocation();

  // Initialize with user's current location
  useEffect(() => {
    if (isOpen && userLocation) {
      setPosition({
        lat: userLocation.latitude,
        lng: userLocation.longitude
      });
      setAccuracy(userLocation.accuracy);
    }
  }, [isOpen, userLocation]);

  const captureLocation = useCallback(async () => {
    try {
      const pos = await getCurrentPosition();
      setPosition({ lat: pos.latitude, lng: pos.longitude });
      setAccuracy(pos.accuracy);
      
      // Find nearby landmarks for triangulation
      if (useTriangulation) {
        const landmarks = await findNearbyLandmarks(pos.latitude, pos.longitude);
        setNearbyOffices(landmarks);
        
        if (landmarks.length > 0) {
          const triangulationPoints = [
            { latitude: pos.latitude, longitude: pos.longitude, accuracy: pos.accuracy },
            ...landmarks.map(l => ({ latitude: l.latitude, longitude: l.longitude, accuracy: 10 }))
          ];
          
          const improvedPosition = calculateWeightedPosition(triangulationPoints);
          if (improvedPosition) {
            setPosition({ 
              lat: improvedPosition.latitude, 
              lng: improvedPosition.longitude 
            });
          }
        }
      }
      
      setStep(2);
    } catch (err) {
      console.error('Error capturing location:', err);
    }
  }, [getCurrentPosition, findNearbyLandmarks, calculateWeightedPosition, useTriangulation]);

  const handleImageSelect = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be smaller than 5MB');
      }

      // Convert to WebP
      const webpFile = await convertImageToWebP(file);
      setImageFile(webpFile);
      
      // Create preview
      const previewUrl = URL.createObjectURL(webpFile);
      setImagePreview(previewUrl);
    } catch (err) {
      console.error('Error processing image:', err);
    }
  }, [convertImageToWebP]);

  const handleMapClick = useCallback((e) => {
    setPosition(e.latlng);
    setAccuracy(10); // Manual placement has higher assumed accuracy
  }, []);

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
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      setStep(4); // Success step
    } catch (err) {
      console.error('Submission error:', err);
    }
  }, [
    position, accuracy, selectedOffice, notes, nearbyOffices, 
    imageFile, agreement, submitContribution, onSuccess
  ]);

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
    
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {step === 1 && 'Contribute Location'}
            {step === 2 && 'Confirm Location'}
            {step === 3 && 'Additional Information'}
            {step === 4 && 'Submission Complete'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {/* Step 1: Location Capture */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Privacy Notice</p>
                    <p>We only collect location data and optional photos. No personal information is stored. All submissions are moderated before being published.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={useTriangulation}
                    onChange={(e) => setUseTriangulation(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
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
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Capture Location
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Map Confirmation */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Confirm the Location
                </h3>
                <p className="text-gray-600">
                  {accuracy ? `Accuracy: ±${Math.round(accuracy)} meters` : 'Tap on the map to place the marker'}
                </p>
              </div>

              <div className="h-64 rounded-lg overflow-hidden border border-gray-300">
                <MapContainer
                  center={position || [userLocation.latitude, userLocation.longitude]}
                  zoom={16}
                  className="h-full w-full"
                  onClick={handleMapClick}
                >
                  {/* You would add markers and accuracy circle here */}
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
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Additional Information */}
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

              {/* Image Upload */}
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

              {/* Notes */}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

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
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Thank You for Your Contribution!
                </h3>
                <p className="text-gray-600 mb-4">
                  Your location data has been submitted and will be reviewed by our team. 
                  This helps improve the accuracy of IEBC office locations for everyone.
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-600">
                  <strong>What happens next:</strong><br />
                  • Your submission enters moderation queue<br />
                  • Our team verifies the location data<br />
                  • Approved updates appear within 48 hours<br />
                  • You're helping build better civic infrastructure
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
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
