// src/components/IEBCOffice/MapIntegration.js
import React, { useState, useCallback, useEffect } from 'react';
import ContributeLocationButton from './ContributeLocationButton';
import { useUserLocation } from '@/hooks/useUserLocation';
import { notificationManager } from '@/components/Common/SuccessNotification';

const MapIntegration = ({ onContributionSuccess, showContributionButton = true }) => {
  const [recentContributions, setRecentContributions] = useState([]);
  const { userLocation, isLoading: locationLoading } = useUserLocation();

  const handleContributionSuccess = useCallback((contributionData) => {
    console.log('Map: Contribution success received:', contributionData);
    
    // Add to recent contributions
    setRecentContributions(prev => [contributionData, ...prev.slice(0, 4)]);
    
    // Show success notification
    notificationManager.showNotification({
      type: 'success',
      title: 'Contribution Submitted!',
      message: 'Your IEBC office location has been added to the moderation queue.',
      isVisible: true
    });

    // Trigger any parent callback
    if (onContributionSuccess) {
      onContributionSuccess(contributionData);
    }

    // Refresh map data after a short delay
    setTimeout(() => {
      if (window.refreshMapData) {
        window.refreshMapData();
      }
    }, 1000);
  }, [onContributionSuccess]);

  // Listen for contribution success events from other components
  useEffect(() => {
    const handleGlobalContributionSuccess = (event) => {
      if (event.detail && event.detail.contributionData) {
        handleContributionSuccess(event.detail.contributionData);
      }
    };

    window.addEventListener('contribution-success', handleGlobalContributionSuccess);
    
    return () => {
      window.removeEventListener('contribution-success', handleGlobalContributionSuccess);
    };
  }, [handleContributionSuccess]);

  return (
    <div className="space-y-4">
      {/* Contribution Button */}
      {showContributionButton && (
        <div className="flex justify-center">
          <ContributeLocationButton 
            onContributionSuccess={handleContributionSuccess}
            className="mb-4"
          />
        </div>
      )}

      {/* Location Status */}
      <div className="text-center">
        {locationLoading && (
          <p className="text-sm text-gray-600 animate-pulse">
            📍 Getting your location...
          </p>
        )}
        
        {userLocation && (
          <p className="text-sm text-green-600">
            ✅ Location ready for contribution
            {userLocation.accuracy && (
              <span className="text-gray-500 ml-2">
                (Accuracy: ±{Math.round(userLocation.accuracy)}m)
              </span>
            )}
          </p>
        )}
      </div>

      {/* Recent Contributions (optional) */}
      {recentContributions.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-sm font-medium text-blue-700 mb-2">
            Recent Contributions:
          </p>
          <div className="space-y-1">
            {recentContributions.map((contribution, index) => (
              <div key={contribution.id || index} className="text-xs text-blue-600">
                • {contribution.submitted_office_location} 
                <span className="text-blue-500 ml-1">
                  (ID: {contribution.id})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapIntegration;
