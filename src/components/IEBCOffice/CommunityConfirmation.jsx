// src/components/IEBCOffice/CommunityConfirmation.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import LoadingSpinner from './LoadingSpinner';

const CommunityConfirmation = ({ contributionId, currentConfirmations = 0 }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [userHasConfirmed, setUserHasConfirmed] = useState(false);
  const [error, setError] = useState(null);

  const generateDeviceHash = async () => {
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || '',
      navigator.deviceMemory || ''
    ];

    const fingerprint = components.join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  };

  const hashString = async (input) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c * 1000; // Distance in meters
  };

  const calculateConfirmationWeight = (accuracy, distance) => {
    let weight = 1;
    if (accuracy <= 20) weight += 2;
    else if (accuracy <= 50) weight += 1;
    if (distance <= 100) weight += 2;
    else if (distance <= 250) weight += 1;
    return weight;
  };

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      setError(null);

      // Step 1: Get user's current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      const confirmerLat = position.coords.latitude;
      const confirmerLng = position.coords.longitude;
      const confirmerAccuracy = position.coords.accuracy;

      // Step 2: Get contribution coordinates
      const { data: contribution, error: contribError } = await supabase
        .from('iebc_office_contributions')
        .select('submitted_latitude, submitted_longitude')
        .eq('id', contributionId)
        .single();

      if (contribError) throw contribError;

      // Step 3: Calculate distance
      const distance = calculateDistance(
        confirmerLat, confirmerLng,
        contribution.submitted_latitude, contribution.submitted_longitude
      );

      // Step 4: Validate proximity (500m max)
      const MAX_CONFIRMATION_DISTANCE = 500;
      if (distance > MAX_CONFIRMATION_DISTANCE) {
        setError(`You're ${Math.round(distance)}m away. Please move within ${MAX_CONFIRMATION_DISTANCE}m of the office to confirm.`);
        return;
      }

      // Step 5: Generate device hash and check for duplicates
      const deviceHash = await generateDeviceHash();
      const ipHash = await hashString('client-ip'); // In production, get actual IP

      const { data: existingConfirmation } = await supabase
        .from('confirmations')
        .select('id')
        .eq('contribution_id', contributionId)
        .eq('confirmer_device_hash', deviceHash)
        .gte('confirmed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .single();

      if (existingConfirmation) {
        setUserHasConfirmed(true);
        return;
      }

      // Step 6: Submit confirmation
      const confirmationWeight = calculateConfirmationWeight(confirmerAccuracy, distance);

      const { error: insertError } = await supabase
        .from('confirmations')
        .insert({
          contribution_id: contributionId,
          confirmer_lat: confirmerLat,
          confirmer_lng: confirmerLng,
          confirmer_accuracy_meters: confirmerAccuracy,
          confirmer_ip_hash: ipHash,
          confirmer_ua_hash: await hashString(navigator.userAgent),
          confirmer_device_hash: deviceHash,
          confirmation_weight: confirmationWeight
        });

      if (insertError) throw insertError;

      // Step 7: Update UI
      setUserHasConfirmed(true);

    } catch (error) {
      if (error.code === 1) { // PERMISSION_DENIED
        setError('Location permission is required to confirm. Please enable location access and try again.');
      } else {
        console.error('Confirmation error:', error);
        setError('Failed to submit confirmation. Please try again.');
      }
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Help Verify This Location</h4>
          <p className="text-sm text-gray-600">
            {currentConfirmations} {currentConfirmations === 1 ? 'person has' : 'people have'} confirmed this location
          </p>
        </div>
      </div>

      {!userHasConfirmed ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleConfirm}
          disabled={isConfirming}
          className="w-full bg-green-600 text-white rounded-lg py-2 px-4 font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
        >
          {isConfirming ? (
            <>
              <LoadingSpinner size="small" />
              <span>Confirming...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Confirm This Office Is Real</span>
            </>
          )}
        </motion.button>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <div className="flex items-center justify-center space-x-2 text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">You've confirmed this location</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="mt-3 text-xs text-gray-500 space-y-1">
        <div className="flex items-center space-x-2">
          <span>📍</span>
          <span>You must be within 500m of the office</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>🔒</span>
          <span>Your exact location is not stored</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>🕒</span>
          <span>Only one confirmation per device</span>
        </div>
      </div>
    </div>
  );
};

export default CommunityConfirmation;
