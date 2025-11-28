// src/components/Admin/ContributionsDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { MapContainer as LeafletMap, TileLayer } from 'react-leaflet';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { useTheme } from '@/contexts/ThemeContext';
import 'leaflet/dist/leaflet.css';

interface DeviceMetadata {
  user_agent?: string;
  platform?: string;
  language?: string;
  timestamp?: string;
  capture_method?: string;
  capture_source?: string;
  accuracy?: number;
  screen_resolution?: string;
  timezone?: string;
  has_touch?: boolean;
  confidence_score?: number;
  duplicate_count?: number;
}

interface ExifMetadata {
  has_exif?: boolean;
  file_size?: number;
  file_type?: string;
  last_modified?: number;
  file_name?: string;
}

interface ReverseGeocodeResult {
  display_name?: string;
  address?: {
    county?: string;
    state?: string;
    state_district?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    [key: string]: any;
  };
  boundingbox?: string[];
  full_result?: any;
}

interface Contribution {
  id: number;
  submitted_office_location: string;
  submitted_county: string;
  submitted_constituency: string;
  submitted_constituency_id?: number;
  submitted_landmark?: string;
  submitted_latitude: number;
  submitted_longitude: number;
  submitted_accuracy_meters?: number;
  google_maps_link?: string;
  image_public_url?: string;
  device_metadata: DeviceMetadata;
  exif_metadata?: ExifMetadata;
  reverse_geocode_result?: ReverseGeocodeResult;
  confidence_score: number;
  duplicate_candidate_ids?: number[];
  confirmation_count?: number;
  status: string;
  created_at: string;
  reviewed_at?: string;
  review_notes?: string;
  reviewer_id?: string;
  submission_source?: string;
  submission_method?: string;
  nearby_landmarks?: any[];
  submitted_timestamp?: string;
  is_archived?: boolean;
  archived_at?: string;
  archive_reason?: string;
  original_office_id?: number;
}

interface ArchiveRecord {
  archive_id: number;
  contribution_id: number;
  original_office_id?: number;
  action_type: string;
  action_timestamp: string;
  actor: string;
  review_notes?: string;
  archive_reason?: string;
  office_name: string;
  county: string;
  constituency: string;
  archived_data: any;
}

interface Constituency {
  id: number;
  name: string;
  county_id: number;
  registration_target: number;
  counties?: {
    name: string;
  };
}

interface ContributionsDashboardProps {
  counties: string[];
}

const DashboardMapContainer: React.FC<{
  center: [number, number];
  zoom: number;
  children: React.ReactNode;
}> = ({ center, zoom, children }) => {
  return (
    <div className="dashboard-map-container" style={{ 
      position: 'relative',
      width: '100%',
      height: '100%',
      zIndex: 1,
      isolation: 'isolate'
    }}>
      <LeafletMap center={center} zoom={zoom} className="h-full w-full" style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        {children}
      </LeafletMap>
    </div>
  );
};

const ContributionCard: React.FC<{
  contribution: Contribution;
  onVerify: (contribution: Contribution) => void;
  onReject: (contribution: Contribution) => void;
  onRequestInfo: (contribution: Contribution) => void;
  onMerge: (contribution: Contribution) => void;
  onViewArchive: () => void;
}> = ({ contribution, onVerify, onReject, onRequestInfo, onMerge, onViewArchive }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [showReverseGeocode, setShowReverseGeocode] = useState(false);
  const { theme } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'pending_review': return 'yellow';
      case 'auto_verified': return 'green';
      case 'more_info_requested': return 'blue';
      case 'flagged_suspicious': return 'red';
      case 'verified': return 'green';
      case 'rejected': return 'red';
      case 'archived': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'pending_review': return 'Pending Review';
      case 'auto_verified': return 'Auto-Verified';
      case 'more_info_requested': return 'More Info Requested';
      case 'flagged_suspicious': return 'Flagged Suspicious';
      case 'verified': return 'Verified';
      case 'rejected': return 'Rejected';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'green';
    if (score >= 60) return 'blue';
    if (score >= 40) return 'yellow';
    return 'red';
  };

  const getConfidenceText = (score: number) => {
    if (score >= 80) return 'High';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Medium';
    return 'Low';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="contribution-card relative z-50 rounded-xl border overflow-hidden bg-card text-card-foreground shadow-sm border-border"
      style={{ 
        position: 'relative',
        zIndex: 50
      }}
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              theme === 'dark' 
                ? `bg-${getStatusColor(contribution.status)}-900 text-${getStatusColor(contribution.status)}-100`
                : `bg-${getStatusColor(contribution.status)}-100 text-${getStatusColor(contribution.status)}-800`
            }`}>
              {getStatusText(contribution.status)}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              theme === 'dark'
                ? `bg-${getConfidenceColor(contribution.confidence_score)}-900 text-${getConfidenceColor(contribution.confidence_score)}-100`
                : `bg-${getConfidenceColor(contribution.confidence_score)}-100 text-${getConfidenceColor(contribution.confidence_score)}-800`
            }`}>
              {getConfidenceText(contribution.confidence_score)} Confidence: {contribution.confidence_score || 0}%
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {new Date(contribution.created_at).toLocaleDateString()}
          </div>
        </div>
        <h3 className="font-semibold text-foreground truncate">
          {contribution.submitted_office_location}
        </h3>
        <p className="text-sm text-muted-foreground">
          {contribution.submitted_county} • {contribution.submitted_constituency}
          {contribution.submitted_constituency_id && ` • ID: ${contribution.submitted_constituency_id}`}
        </p>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-xs text-muted-foreground">
            Method: {contribution.submission_method || 'Unknown'}
          </span>
          <span className="text-xs text-muted-foreground">
            Source: {contribution.submission_source || 'Unknown'}
          </span>
          {contribution.is_archived && (
            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
              Archived
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div className="h-48 rounded-lg overflow-hidden border border-border relative z-10">
            <DashboardMapContainer
              center={[contribution.submitted_latitude, contribution.submitted_longitude]}
              zoom={15}
            >
              <GeoJSONLayerManager
                activeLayers={['iebc-offices']}
                onOfficeSelect={() => {}}
                onNearbyOfficesFound={() => {}}
                selectedOffice={null}
              />
              <UserLocationMarker
                position={[contribution.submitted_latitude, contribution.submitted_longitude]}
                accuracy={contribution.submitted_accuracy_meters || 50}
              />
            </DashboardMapContainer>
          </div>

          <div className="space-y-3 relative z-50">
            <div>
              <label className="text-sm font-medium text-foreground mb-2">Coordinates</label>
              <p className="text-sm text-foreground font-mono">
                {contribution.submitted_latitude.toFixed(6)}, {contribution.submitted_longitude.toFixed(6)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground mb-2">GPS Accuracy</label>
              <p className="text-sm text-foreground">
                {contribution.submitted_accuracy_meters ? `±${Math.round(contribution.submitted_accuracy_meters)}m` : 'Unknown'}
              </p>
            </div>

            {contribution.submitted_landmark && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2">Landmark</label>
                <p className="text-sm text-foreground">{contribution.submitted_landmark}</p>
              </div>
            )}

            {contribution.google_maps_link && (
              <div>
                <label className="text-sm font-medium text-foreground mb-2">Google Maps</label>
                <a 
                  href={contribution.google_maps_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary/80 truncate block"
                >
                  View on Maps
                </a>
              </div>
            )}

            {contribution.reverse_geocode_result && (
              <div>
                <button
                  onClick={() => setShowReverseGeocode(!showReverseGeocode)}
                  className="text-sm font-medium text-foreground mb-2 flex items-center space-x-1 hover:text-primary transition-colors"
                >
                  <span>Location Details</span>
                  <svg 
                    className={`w-4 h-4 transition-transform ${showReverseGeocode ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <AnimatePresence>
                  {showReverseGeocode && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-muted rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">
                          {contribution.reverse_geocode_result.display_name}
                        </p>
                        {contribution.reverse_geocode_result.address && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <div>Road: {contribution.reverse_geocode_result.address.road || 'N/A'}</div>
                            <div>Neighborhood: {contribution.reverse_geocode_result.address.neighbourhood || 'N/A'}</div>
                            <div>Suburb: {contribution.reverse_geocode_result.address.suburb || 'N/A'}</div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {contribution.image_public_url && (
          <div className="mb-4 relative z-50">
            <label className="text-sm font-medium text-foreground mb-2 block">Photo Evidence</label>
            <div className="flex space-x-4">
              <div className="w-32 h-32 rounded-lg overflow-hidden border border-border">
                {imageLoading && (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <LoadingSpinner size="small" />
                  </div>
                )}
                <img
                  src={contribution.image_public_url}
                  alt="Office evidence"
                  className="w-full h-full object-cover"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </div>
              
              <div className="flex-1">
                {contribution.exif_metadata && (
                  <div className="mb-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                        contribution.exif_metadata.has_exif 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                      }`}>
                        {contribution.exif_metadata.has_exif ? '✓ EXIF Data Available' : '⚠ No EXIF Data'}
                      </span>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div>File: {contribution.exif_metadata.file_name || 'Unknown'}</div>
                      <div>Size: {contribution.exif_metadata.file_size ? `${(contribution.exif_metadata.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}</div>
                      <div>Type: {contribution.exif_metadata.file_type || 'Unknown'}</div>
                      {contribution.exif_metadata.last_modified && (
                        <div>Modified: {new Date(contribution.exif_metadata.last_modified).toLocaleString()}</div>
                      )}
                    </div>
                  </div>
                )}

                {contribution.nearby_landmarks && contribution.nearby_landmarks.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-foreground mb-1 block">Nearby Landmarks ({contribution.nearby_landmarks.length})</label>
                    <div className="text-xs text-muted-foreground space-y-1 max-h-20 overflow-y-auto">
                      {contribution.nearby_landmarks.slice(0, 3).map((landmark, index) => (
                        <div key={index} className="flex justify-between">
                          <span>{landmark.name || landmark.landmark_name}</span>
                          <span>{landmark.distance_meters ? `${Math.round(landmark.distance_meters)}m` : ''}</span>
                        </div>
                      ))}
                      {contribution.nearby_landmarks.length > 3 && (
                        <div className="text-xs text-muted-foreground italic">
                          +{contribution.nearby_landmarks.length - 3} more landmarks
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-4">
          {contribution.duplicate_candidate_ids && contribution.duplicate_candidate_ids.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg p-3 relative z-50">
              <div className="flex items-start space-x-3">
                <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                    Potential Duplicate Office Detected
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    {contribution.duplicate_candidate_ids.length} verified office{contribution.duplicate_candidate_ids.length === 1 ? '' : 's'} within 100m radius.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-3 relative z-50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Confidence Analysis</span>
              </div>
              <span className={`text-sm font-medium ${
                contribution.confidence_score >= 80 ? 'text-green-600 dark:text-green-400' :
                contribution.confidence_score >= 60 ? 'text-blue-600 dark:text-blue-400' :
                contribution.confidence_score >= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {contribution.confidence_score}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className={`h-2 rounded-full ${
                  contribution.confidence_score >= 80 ? 'bg-green-600' :
                  contribution.confidence_score >= 60 ? 'bg-blue-600' :
                  contribution.confidence_score >= 40 ? 'bg-yellow-600' :
                  'bg-red-600'
                }`}
                style={{ width: `${contribution.confidence_score}%` }}
              ></div>
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-400 mt-2 space-y-1">
              <div>✓ GPS Accuracy: {contribution.submitted_accuracy_meters ? `±${Math.round(contribution.submitted_accuracy_meters)}m` : 'Unknown'}</div>
              <div>✓ Photo Evidence: {contribution.image_public_url ? 'Available' : 'Not Available'}</div>
              <div>✓ Location Data: {contribution.reverse_geocode_result ? 'Verified' : 'Not Verified'}</div>
              <div>✓ Duplicates Checked: {contribution.duplicate_candidate_ids?.length || 0} found</div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 dark:bg-gray-900/20 dark:border-gray-800 rounded-lg p-3 relative z-50">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-300">Submission Details</span>
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-400 mt-1 space-y-1">
              <div>Method: {contribution.submission_method || 'Unknown'}</div>
              <div>Source: {contribution.submission_source || 'Web'}</div>
              <div>Submitted: {contribution.submitted_timestamp ? new Date(contribution.submitted_timestamp).toLocaleString() : new Date(contribution.created_at).toLocaleString()}</div>
              {contribution.confirmation_count && contribution.confirmation_count > 0 && (
                <div>Confirmations: {contribution.confirmation_count}</div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left p-2 rounded-lg hover:bg-accent transition-colors relative z-50 text-foreground"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Device & Technical Metadata</span>
            <svg 
              className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden relative z-50"
            >
              <div className="mt-2 p-3 bg-muted rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Device Information</h4>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify({
                        platform: contribution.device_metadata.platform,
                        user_agent: contribution.device_metadata.user_agent?.substring(0, 100) + '...',
                        language: contribution.device_metadata.language,
                        screen_resolution: contribution.device_metadata.screen_resolution,
                        timezone: contribution.device_metadata.timezone,
                        has_touch: contribution.device_metadata.has_touch
                      }, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">Capture Details</h4>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {JSON.stringify({
                        capture_method: contribution.device_metadata.capture_method,
                        capture_source: contribution.device_metadata.capture_source,
                        accuracy: contribution.device_metadata.accuracy,
                        duplicate_count: contribution.device_metadata.duplicate_count,
                        confidence_score: contribution.device_metadata.confidence_score,
                        timestamp: contribution.device_metadata.timestamp
                      }, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-4 border-t border-border relative z-50 bg-muted/50">
        <div className="flex flex-wrap gap-2">
          {(contribution.status === 'pending' || contribution.status === 'pending_review') && (
            <>
              <button
                onClick={() => onVerify(contribution)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Verify & Archive</span>
              </button>

              {contribution.duplicate_candidate_ids && contribution.duplicate_candidate_ids.length > 0 && (
                <button
                  onClick={() => onMerge(contribution)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Merge & Archive</span>
                </button>
              )}

              <button
                onClick={() => onRequestInfo(contribution)}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>Request Info</span>
              </button>

              <button
                onClick={() => onReject(contribution)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Reject & Archive</span>
              </button>
            </>
          )}

          {(contribution.status === 'verified' || contribution.status === 'rejected' || contribution.is_archived) && (
            <div className="flex items-center space-x-4 w-full">
              <div className="text-sm text-muted-foreground flex-1">
                {contribution.is_archived ? (
                  <div>
                    <span className="font-medium">Archived</span> • {contribution.archived_at ? new Date(contribution.archived_at).toLocaleString() : 'N/A'}
                    {contribution.archive_reason && (
                      <span> • Reason: {contribution.archive_reason}</span>
                    )}
                  </div>
                ) : (
                  <div>
                    Reviewed by: {contribution.reviewer_id || 'System'} • {contribution.reviewed_at ? new Date(contribution.reviewed_at).toLocaleString() : 'N/A'}
                  </div>
                )}
                {contribution.review_notes && (
                  <div className="mt-1 text-xs">
                    Notes: {contribution.review_notes}
                  </div>
                )}
              </div>
              <button
                onClick={onViewArchive}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs font-medium transition-colors"
              >
                View Archive
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ArchiveView: React.FC<{
  archives: ArchiveRecord[];
  onClose: () => void;
  onRestore: (archive: ArchiveRecord) => void;
}> = ({ archives, onClose, onRestore }) => {
  const { theme } = useTheme();

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'verified': return 'green';
      case 'rejected': return 'red';
      case 'merged': return 'blue';
      case 'archived': return 'gray';
      default: return 'gray';
    }
  };

  const getActionText = (actionType: string) => {
    switch (actionType) {
      case 'verified': return 'Verified';
      case 'rejected': return 'Rejected';
      case 'merged': return 'Merged';
      case 'archived': return 'Archived';
      default: return actionType;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10002]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Archive History</h2>
            <p className="text-gray-600 dark:text-gray-400">View archived contributions and their actions</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {archives.map((archive) => (
              <div
                key={archive.archive_id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      theme === 'dark' 
                        ? `bg-${getActionColor(archive.action_type)}-900 text-${getActionColor(archive.action_type)}-100`
                        : `bg-${getActionColor(archive.action_type)}-100 text-${getActionColor(archive.action_type)}-800`
                    }`}>
                      {getActionText(archive.action_type)}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {archive.office_name}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(archive.action_timestamp).toLocaleString()}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Location:</span>
                    <p className="text-gray-600 dark:text-gray-400">
                      {archive.county} • {archive.constituency}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Actor:</span>
                    <p className="text-gray-600 dark:text-gray-400">{archive.actor}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Office ID:</span>
                    <p className="text-gray-600 dark:text-gray-400">
                      {archive.original_office_id || 'New Office'}
                    </p>
                  </div>
                </div>

                {archive.review_notes && (
                  <div className="mt-3">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Review Notes:</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{archive.review_notes}</p>
                  </div>
                )}

                {archive.archive_reason && (
                  <div className="mt-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Archive Reason:</span>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{archive.archive_reason}</p>
                  </div>
                )}

                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    onClick={() => onRestore(archive)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(archive.archived_data, null, 2));
                      alert('Archive data copied to clipboard!');
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
                  >
                    Copy Data
                  </button>
                </div>
              </div>
            ))}
          </div>

          {archives.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Archive Records</h3>
              <p className="text-gray-500 dark:text-gray-400">No contributions have been archived yet.</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const ConstituencyManager: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConstituencySelect: (constituency: Constituency) => void;
}> = ({ isOpen, onClose, onConstituencySelect }) => {
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConstituencies = constituencies.filter(constituency =>
    constituency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    constituency.counties?.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      fetchConstituencies();
    }
  }, [isOpen]);

  const fetchConstituencies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('constituencies')
        .select('*, counties(name)')
        .order('name');

      if (error) throw error;
      setConstituencies(data || []);
    } catch (error) {
      console.error('Error fetching constituencies:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[10002]"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Select Constituency</h2>
            <p className="text-gray-600 dark:text-gray-400">Choose a constituency for the office</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search constituencies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <LoadingSpinner size="medium" />
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredConstituencies.map((constituency) => (
                <button
                  key={constituency.id}
                  onClick={() => onConstituencySelect(constituency)}
                  className="w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{constituency.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {constituency.counties?.name} • ID: {constituency.id}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          )}

          {filteredConstituencies.length === 0 && !loading && (
            <div className="text-center p-8">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No constituencies found</h3>
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm ? 'Try a different search term' : 'No constituencies available'}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const ContributionsDashboard: React.FC<ContributionsDashboardProps> = ({ counties = [] }) => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [showConstituencyManager, setShowConstituencyManager] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    county: 'all',
    confidence: 'all',
    hasPhoto: 'all',
    showArchived: false
  });
  const [stats, setStats] = useState({
    pending: 0,
    verified_today: 0,
    rejected: 0,
    total: 0,
    high_confidence: 0,
    archived: 0
  });
  const { theme } = useTheme();

  // Handle logout
  const handleLogout = () => {
    sessionStorage.removeItem('admin_authenticated');
    sessionStorage.removeItem('admin_auth_timestamp');
    window.location.href = '/';
  };

  const safeCounties = Array.isArray(counties) ? counties : [];
  const safeContributions = Array.isArray(contributions) ? contributions : [];

  const getConstituencyIdFromName = useCallback(async (constituencyName: string, countyName?: string): Promise<number | null> => {
    if (!constituencyName) return null;

    try {
      console.log('Looking up constituency ID for:', constituencyName, 'county:', countyName);
      
      const { data, error } = await supabase
        .rpc('get_or_create_constituency' as any, {
          constituency_name: constituencyName,
          county_name: countyName || ''
        });

      if (error) {
        console.error('RPC failed, trying manual lookup:', error);
        
        let query = supabase
          .from('constituencies')
          .select('id, name, county_id')
          .ilike('name', `%${constituencyName}%`);

        if (countyName) {
          query = query.eq('counties.name', countyName);
        }

        const { data: manualData, error: manualError } = await query;

        if (manualError) {
          console.error('Manual lookup failed:', manualError);
          return null;
        }

        if (manualData && manualData.length > 0) {
          console.log('Found constituency manually:', manualData[0]);
          return manualData[0].id;
        }

        return null;
      }

      console.log('Found constituency via RPC:', data);
      return data as number;

    } catch (err) {
      console.error('Error in getConstituencyIdFromName:', err);
      return null;
    }
  }, []);

  const fixAllConstituencyRelationships = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('fix_all_constituency_relationships' as any);

      if (error) throw error;

      alert(`Successfully fixed constituency relationships! Updated ${data[0].offices_updated} offices and ${data[0].contributions_updated} contributions.`);
      await fetchContributions();
    } catch (err: any) {
      console.error('Error fixing constituency relationships:', err);
      alert('Failed to fix constituency relationships: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchContributions = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data, error } = await (async (): Promise<any> => {
        let queryBuilder: any = supabase
          .from('iebc_office_contributions')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters.status !== 'all') {
          queryBuilder = queryBuilder.eq('status', filters.status);
        }
        if (filters.county !== 'all') {
          queryBuilder = queryBuilder.eq('submitted_county', filters.county);
        }
        if (filters.hasPhoto !== 'all') {
          if (filters.hasPhoto === 'yes') {
            queryBuilder = queryBuilder.not('image_public_url', 'is', null);
          } else {
            queryBuilder = queryBuilder.is('image_public_url', null);
          }
        }
        if (filters.confidence === 'high') {
          queryBuilder = queryBuilder.gte('confidence_score', 80);
        } else if (filters.confidence === 'medium') {
          queryBuilder = queryBuilder.gte('confidence_score', 50).lt('confidence_score', 80);
        } else if (filters.confidence === 'low') {
          queryBuilder = queryBuilder.lt('confidence_score', 50);
        }
        if (!filters.showArchived) {
          queryBuilder = queryBuilder.eq('is_archived', false);
        }

        return await queryBuilder;
      })();

      if (error) throw error;
      setContributions(Array.isArray(data) ? data.map((item: any) => ({
        ...item,
        device_metadata: (item.device_metadata || {}) as DeviceMetadata,
        exif_metadata: (item.exif_metadata || {}) as ExifMetadata,
        reverse_geocode_result: (item.reverse_geocode_result || {}) as ReverseGeocodeResult,
        nearby_landmarks: Array.isArray(item.nearby_landmarks) ? item.nearby_landmarks : []
      } as Contribution)) : []);
    } catch (err: any) {
      console.error('Error fetching contributions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const { data: pendingData } = await (supabase as any)
        .from('iebc_office_contributions')
        .select('id')
        .eq('status', 'pending_review')
        .eq('is_archived', false);

      const today = new Date().toISOString().split('T')[0];
      const { data: todayData } = await (supabase as any)
        .from('iebc_office_contributions')
        .select('id')
        .eq('status', 'verified')
        .gte('reviewed_at', today)
        .eq('is_archived', false);

      const { data: rejectedData } = await (supabase as any)
        .from('iebc_office_contributions')
        .select('id')
        .eq('status', 'rejected')
        .eq('is_archived', false);

      const { data: totalData } = await (supabase as any)
        .from('iebc_office_contributions')
        .select('id')
        .eq('is_archived', false);

      const { data: highConfidenceData } = await (supabase as any)
        .from('iebc_office_contributions')
        .select('id')
        .gte('confidence_score', 80)
        .eq('status', 'pending_review')
        .eq('is_archived', false);

      const { data: archivedData } = await (supabase as any)
        .from('iebc_office_contributions')
        .select('id')
        .eq('is_archived', true);

      setStats({
        pending: pendingData?.length || 0,
        verified_today: todayData?.length || 0,
        rejected: rejectedData?.length || 0,
        total: totalData?.length || 0,
        high_confidence: highConfidenceData?.length || 0,
        archived: archivedData?.length || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchArchives = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_archived_contributions' as any, {
          p_limit: 100,
          p_offset: 0
        });

      if (error) throw error;
      setArchives((data || []) as ArchiveRecord[]);
    } catch (err: any) {
      console.error('Error fetching archives:', err);
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchContributions();
    fetchStats();

    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchContributions, fetchStats]);

  const archiveContribution = async (
    contributionId: number,
    actionType: 'verified' | 'rejected' | 'merged',
    reviewNotes: string,
    originalOfficeId?: number
  ) => {
    try {
      const { data, error } = await supabase
        .rpc('archive_contribution' as any, {
          p_contribution_id: contributionId,
          p_action_type: actionType,
          p_actor: 'admin_dashboard',
          p_review_notes: reviewNotes,
          p_archive_reason: `Contribution ${actionType} by admin`,
          p_original_office_id: originalOfficeId || null
        });

      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error('Error archiving contribution:', err);
      throw err;
    }
  };

  const handleVerify = async (contribution: Contribution, constituencyId?: number) => {
    try {
      console.log('Verifying and archiving contribution:', contribution.id);
      
      const shouldMerge = contribution.duplicate_candidate_ids && contribution.duplicate_candidate_ids.length > 0;
      
      if (shouldMerge) {
        const confirmMerge = confirm(
          `This contribution has ${contribution.duplicate_candidate_ids.length} potential duplicate(s). Do you want to merge with an existing office instead of creating a new one?`
        );
        
        if (confirmMerge) {
          await handleMerge(contribution);
          return;
        }
      }

      let finalConstituencyId = constituencyId || contribution.submitted_constituency_id;
      
      if (!finalConstituencyId || finalConstituencyId === 0) {
        console.log('No valid constituency ID found, looking up by name...');
        finalConstituencyId = await getConstituencyIdFromName(
          contribution.submitted_constituency,
          contribution.submitted_county
        );
      }

      if (!finalConstituencyId) {
        setSelectedContribution(contribution);
        setShowConstituencyManager(true);
        return;
      }

      console.log('Using constituency ID for office creation:', finalConstituencyId);

      const { data: newOffice, error: officeError } = await supabase
        .from('iebc_offices')
        .insert([{
          constituency: contribution.submitted_constituency,
          constituency_code: finalConstituencyId,
          office_location: contribution.submitted_office_location,
          landmark: contribution.submitted_landmark || undefined,
          latitude: contribution.submitted_latitude,
          longitude: contribution.submitted_longitude,
          county: contribution.submitted_county,
          constituency_name: contribution.submitted_constituency,
          verification_source: 'admin_manual',
          verified_by: 'admin_dashboard',
          verified_at: new Date().toISOString(),
          created_from_contribution_id: contribution.id,
          confidence_score: contribution.confidence_score,
          submission_method: contribution.submission_method,
          image_url: contribution.image_public_url
        }])
        .select()
        .single();

      if (officeError) {
        console.error('Error creating office:', officeError);
        
        if (officeError.code === '23503' && officeError.message.includes('constituency')) {
          throw new Error(`Failed to create office: The constituency ID "${finalConstituencyId}" does not exist in the constituencies table.`);
        }
        
        throw new Error(`Failed to create office: ${officeError.message}`);
      }

      await archiveContribution(
        contribution.id,
        'verified',
        'Verified and published as new IEBC office',
        newOffice.id
      );

      await supabase.from('verification_log').insert({
        contribution_id: contribution.id,
        office_id: newOffice.id,
        action: 'verified',
        actor: 'admin:dashboard',
        details: {
          confidence_score: contribution.confidence_score,
          submission_method: contribution.submission_method,
          has_image: !!contribution.image_public_url,
          archived: true
        }
      });

      await fetchContributions();
      await fetchStats();
      
      alert(`Contribution verified and archived successfully! New office created with ID: ${newOffice.id}`);
    } catch (err: any) {
      console.error('Error verifying contribution:', err);
      alert('Failed to verify contribution: ' + err.message);
    }
  };

  const handleReject = async (contribution: Contribution) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await archiveContribution(
        contribution.id,
        'rejected',
        reason
      );

      await supabase.from('verification_log').insert({
        contribution_id: contribution.id,
        action: 'rejected',
        actor: 'admin:dashboard',
        details: { 
          reason,
          confidence_score: contribution.confidence_score,
          archived: true
        }
      });

      await fetchContributions();
      await fetchStats();
      
      alert('Contribution rejected and archived successfully!');
    } catch (err: any) {
      console.error('Error rejecting contribution:', err);
      alert('Failed to reject contribution: ' + err.message);
    }
  };

  const handleRequestInfo = async (contribution: Contribution) => {
    const message = prompt('Enter information request:');
    if (!message) return;

    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status: 'more_info_requested',
          review_notes: message,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', contribution.id);

      if (error) throw error;

      await fetchContributions();
      alert('Information request sent successfully!');
    } catch (err: any) {
      console.error('Error requesting information:', err);
      alert('Failed to send information request: ' + err.message);
    }
  };

  const handleMerge = async (contribution: Contribution) => {
    try {
      const { data: duplicates, error: dupError } = await supabase
        .rpc('find_duplicate_offices', {
          p_lat: contribution.submitted_latitude,
          p_lng: contribution.submitted_longitude,
          p_name: contribution.submitted_office_location,
          p_radius_meters: 200
        });

      if (dupError) throw dupError;

      if (duplicates && duplicates.length > 0) {
        const duplicateList = duplicates.map((d: any) => 
          `${d.office_name} (ID: ${d.id}, ${Math.round(d.distance_meters)}m away)`
        ).join('\n');

        const selectedId = prompt(
          `Merge this contribution with which existing office?\n\nPotential duplicates:\n${duplicateList}\n\nEnter the Office ID to merge with:`
        );

        if (selectedId) {
          const officeId = parseInt(selectedId);
          const selectedOffice = duplicates.find((d: any) => d.id === officeId);
          
          if (selectedOffice) {
            await archiveContribution(
              contribution.id,
              'merged',
              `Merged with existing office: ${selectedOffice.office_name}`,
              officeId
            );

            await supabase.from('verification_log').insert({
              contribution_id: contribution.id,
              office_id: officeId,
              action: 'merged_existing',
              actor: 'admin:dashboard',
              details: {
                existing_office: selectedOffice.office_name,
                distance: selectedOffice.distance_meters,
                confidence_score: contribution.confidence_score,
                archived: true
              }
            });

            await fetchContributions();
            await fetchStats();
            
            alert(`Contribution merged and archived successfully with office: ${selectedOffice.office_name}`);
          } else {
            alert('Invalid office ID selected.');
          }
        }
      } else {
        alert('No suitable duplicates found for merging.');
      }
    } catch (err: any) {
      console.error('Error merging contribution:', err);
      alert('Failed to merge contribution: ' + err.message);
    }
  };

  const handleRestoreArchive = async (archive: ArchiveRecord) => {
    const confirmRestore = confirm(
      `Are you sure you want to restore this archived contribution? This will make it available for review again.`
    );

    if (!confirmRestore) return;

    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          is_archived: false,
          archived_at: null,
          archive_reason: null,
          status: 'pending_review'
        })
        .eq('id', archive.contribution_id);

      if (error) throw error;

      await fetchContributions();
      await fetchStats();
      await fetchArchives();
      
      alert('Contribution restored successfully!');
    } catch (err: any) {
      console.error('Error restoring archive:', err);
      alert('Failed to restore contribution: ' + err.message);
    }
  };

  const handleBulkAction = async (action: 'verify' | 'reject', contributionIds: number[]) => {
    const confirmMessage = action === 'verify' 
      ? `Are you sure you want to verify and archive ${contributionIds.length} contributions?`
      : `Are you sure you want to reject and archive ${contributionIds.length} contributions?`;

    if (!confirm(confirmMessage)) return;

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of contributionIds) {
        try {
          const contribution = safeContributions.find(c => c.id === id);
          if (contribution) {
            if (action === 'verify') {
              await handleVerify(contribution);
            } else {
              await handleReject(contribution);
            }
            successCount++;
          }
        } catch (err) {
          console.error(`Error processing contribution ${id}:`, err);
          errorCount++;
        }
      }
      
      if (errorCount > 0) {
        alert(`Processed ${successCount} contributions successfully. ${errorCount} failed.`);
      } else {
        alert(`Successfully processed and archived ${successCount} contributions!`);
      }
    } catch (err: any) {
      console.error('Error in bulk action:', err);
      alert('Failed to process bulk action: ' + err.message);
    }
  };

  const handleViewArchive = async () => {
    setShowArchive(true);
    await fetchArchives();
  };

  const handleConstituencySelect = (constituency: Constituency) => {
    if (selectedContribution) {
      handleVerify(selectedContribution, constituency.id);
    }
    setShowConstituencyManager(false);
    setSelectedContribution(null);
  };

  if (loading && safeContributions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64 relative z-[10000]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div 
      className="contributions-dashboard min-h-screen bg-background text-foreground relative"
      style={{
        zIndex: 10000,
        position: 'relative',
        isolation: 'isolate'
      }}
    >
      <div 
        className="bg-card text-card-foreground shadow-sm border-b border-border relative z-[10001]"
        style={{ zIndex: 10001 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Contributions Dashboard</h1>
              <p className="text-muted-foreground">Manage and verify IEBC office location submissions</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fixAllConstituencyRelationships}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Fix Constituencies</span>
              </button>
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleString()}
              </div>
              <button
                onClick={handleViewArchive}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span>View Archive</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-[10001]"
        style={{ zIndex: 10001 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-semibold text-foreground">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">High Confidence</p>
                <p className="text-2xl font-semibold text-foreground">{stats.high_confidence}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Verified Today</p>
                <p className="text-2xl font-semibold text-foreground">{stats.verified_today}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-2xl font-semibold text-foreground">{stats.rejected}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Archived</p>
                <p className="text-2xl font-semibold text-foreground">{stats.archived}</p>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Active</p>
                <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6 mb-6 relative z-[10001]">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
              >
                <option value="all">All Status</option>
                <option value="pending_review">Pending Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="auto_verified">Auto-Verified</option>
                <option value="more_info_requested">Info Requested</option>
                <option value="flagged_suspicious">Flagged</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">County</label>
              <select
                value={filters.county}
                onChange={(e) => setFilters(prev => ({ ...prev, county: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
              >
                <option value="all">All Counties</option>
                {safeCounties.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confidence</label>
              <select
                value={filters.confidence}
                onChange={(e) => setFilters(prev => ({ ...prev, confidence: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
              >
                <option value="all">All Confidence</option>
                <option value="high">High (80-100%)</option>
                <option value="medium">Medium (50-79%)</option>
                <option value="low">Low (0-49%)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Photo</label>
              <select
                value={filters.hasPhoto}
                onChange={(e) => setFilters(prev => ({ ...prev, hasPhoto: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
              >
                <option value="all">All</option>
                <option value="yes">With Photo</option>
                <option value="no">Without Photo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Archive</label>
              <select
                value={filters.showArchived.toString()}
                onChange={(e) => setFilters(prev => ({ ...prev, showArchived: e.target.value === 'true' }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
              >
                <option value="false">Hide Archived</option>
                <option value="true">Show Archived</option>
              </select>
            </div>
          </div>

          {safeContributions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-foreground">Bulk Actions:</span>
                <button
                  onClick={() => handleBulkAction('verify', safeContributions.map(c => c.id))}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  Verify & Archive All
                </button>
                <button
                  onClick={() => handleBulkAction('reject', safeContributions.map(c => c.id))}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  Reject & Archive All
                </button>
                <span className="text-sm text-muted-foreground">
                  Showing {safeContributions.length} contribution{safeContributions.length === 1 ? '' : 's'}
                  {filters.showArchived && ' (including archived)'}
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded-lg p-4 mb-6 relative z-[10001]">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 relative z-[10001]">
          {safeContributions.map((contribution) => (
            <ContributionCard
              key={contribution.id}
              contribution={contribution}
              onVerify={handleVerify}
              onReject={handleReject}
              onRequestInfo={handleRequestInfo}
              onMerge={handleMerge}
              onViewArchive={handleViewArchive}
            />
          ))}
        </div>

        {safeContributions.length === 0 && !loading && (
          <div className="text-center py-12 relative z-[10001]">
            <svg className="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-foreground mb-2">No contributions found</h3>
            <p className="text-muted-foreground">
              {filters.showArchived 
                ? 'No submissions match your current filters, including archived contributions.'
                : 'No active submissions match your current filters.'
              }
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showArchive && (
          <ArchiveView
            archives={archives}
            onClose={() => setShowArchive(false)}
            onRestore={handleRestoreArchive}
          />
        )}
      </AnimatePresence>

      <ConstituencyManager
        isOpen={showConstituencyManager}
        onClose={() => {
          setShowConstituencyManager(false);
          setSelectedContribution(null);
        }}
        onConstituencySelect={handleConstituencySelect}
      />

      <style>{`
        .contributions-dashboard {
          z-index: 10000 !important;
          position: relative !important;
        }
        
        .contributions-dashboard * {
          position: relative !important;
          z-index: inherit !important;
        }
        
        .dashboard-map-container .leaflet-container {
          z-index: 1 !important;
          position: relative !important;
        }
        
        .dashboard-map-container .leaflet-tile-pane,
        .dashboard-map-container .leaflet-marker-pane,
        .dashboard-map-container .leaflet-popup-pane {
          z-index: 1 !important;
        }
        
        .contribution-card {
          z-index: 50 !important;
        }
        
        .contributions-dashboard > * {
          z-index: 10001 !important;
        }
      `}</style>
    </div>
  );
};

export default ContributionsDashboard;
