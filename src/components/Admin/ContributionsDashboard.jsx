// src/components/Admin/ContributionsDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { useTheme } from '@/contexts/ThemeContext';

interface DeviceMetadata {
  user_agent?: string;
  platform?: string;
  language?: string;
  timestamp?: string;
  capture_method?: string;
  capture_source?: string;
}

interface ExifMetadata {
  exif_gps_match?: boolean;
  exif_device?: string;
  exif_timestamp?: string;
  exif_latitude?: number;
  exif_longitude?: number;
}

interface Contribution {
  id: number;
  submitted_office_location: string;
  submitted_county: string;
  submitted_constituency: string;
  submitted_landmark?: string;
  submitted_latitude: number;
  submitted_longitude: number;
  submitted_accuracy_meters?: number;
  google_maps_link?: string;
  image_public_url?: string;
  device_metadata: DeviceMetadata;
  exif_metadata?: ExifMetadata;
  confidence_score: number;
  duplicate_candidate_ids?: number[];
  confirmation_count?: number;
  status: string;
  created_at: string;
  reviewed_at?: string;
  review_notes?: string;
  reviewer_id?: string;
}

interface ContributionsDashboardProps {
  onLogout: () => void;
  counties: string[];
}

// Custom Map Container for Dashboard with Isolated Z-Index
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
      <MapContainer center={center} zoom={zoom} className="h-full w-full">
        {children}
      </MapContainer>
    </div>
  );
};

const ContributionCard: React.FC<{
  contribution: Contribution;
  onVerify: (contribution: Contribution) => void;
  onReject: (contribution: Contribution) => void;
  onRequestInfo: (contribution: Contribution) => void;
  onMerge: (contribution: Contribution) => void;
}> = ({ contribution, onVerify, onReject, onRequestInfo, onMerge }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const { theme } = useTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'yellow';
      case 'auto_verified': return 'green';
      case 'more_info_requested': return 'blue';
      case 'flagged_suspicious': return 'red';
      case 'verified': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'auto_verified': return 'Auto-Verified';
      case 'more_info_requested': return 'More Info Requested';
      case 'flagged_suspicious': return 'Flagged Suspicious';
      case 'verified': return 'Verified';
      case 'rejected': return 'Rejected';
      default: return status;
    }
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
      {/* Header */}
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
            <span className="text-sm text-muted-foreground">
              Confidence: {contribution.confidence_score || 0}%
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
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Map Preview */}
          <div className="h-48 rounded-lg overflow-hidden border border-border relative z-10">
            <DashboardMapContainer
              center={[contribution.submitted_latitude, contribution.submitted_longitude]}
              zoom={15}
            >
              <GeoJSONLayerManager
                activeLayers={['iebc-offices']}
                onOfficeSelect={() => {}}
                selectedOffice={null}
              />
              <UserLocationMarker
                position={[contribution.submitted_latitude, contribution.submitted_longitude]}
                accuracy={contribution.submitted_accuracy_meters || 50}
                color="#34C759"
              />
            </DashboardMapContainer>
          </div>

          {/* Details */}
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
          </div>
        </div>

        {/* Evidence Section */}
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
              
              {contribution.exif_metadata && (
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                      contribution.exif_metadata.exif_gps_match 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                    }`}>
                      {contribution.exif_metadata.exif_gps_match ? '✓ EXIF GPS Matches' : '⚠ EXIF GPS Mismatch'}
                    </span>
                  </div>
                  
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Device: {contribution.exif_metadata.exif_device || 'Unknown'}</div>
                    {contribution.exif_metadata.exif_timestamp && (
                      <div>Photo taken: {new Date(contribution.exif_metadata.exif_timestamp).toLocaleString()}</div>
                    )}
                    {contribution.exif_metadata.exif_latitude && (
                      <div>
                        EXIF coords: {contribution.exif_metadata.exif_latitude.toFixed(6)}, {contribution.exif_metadata.exif_longitude.toFixed(6)}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Warnings */}
        {contribution.duplicate_candidate_ids && contribution.duplicate_candidate_ids.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800 rounded-lg p-3 mb-4 relative z-50">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-sm text-yellow-700 dark:text-yellow-300">
                {contribution.duplicate_candidate_ids.length} potential duplicate(s) found within 200m
              </span>
            </div>
          </div>
        )}

        {contribution.confirmation_count && contribution.confirmation_count > 0 && (
          <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800 rounded-lg p-3 mb-4 relative z-50">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {contribution.confirmation_count} community confirmation{contribution.confirmation_count > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}

        {/* Expandable Device Metadata */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left p-2 rounded-lg hover:bg-accent transition-colors relative z-50 text-foreground"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Device Metadata</span>
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
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(contribution.device_metadata, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-border relative z-50 bg-muted/50">
        <div className="flex flex-wrap gap-2">
          {contribution.status === 'pending' && (
            <>
              <button
                onClick={() => onVerify(contribution)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Verify</span>
              </button>

              {contribution.duplicate_candidate_ids && contribution.duplicate_candidate_ids.length > 0 && (
                <button
                  onClick={() => onMerge(contribution)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  <span>Merge</span>
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
                <span>Reject</span>
              </button>
            </>
          )}

          {(contribution.status === 'verified' || contribution.status === 'rejected') && (
            <div className="text-sm text-muted-foreground">
              Reviewed by: {contribution.reviewer_id || 'System'} • {contribution.reviewed_at ? new Date(contribution.reviewed_at).toLocaleString() : 'N/A'}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const ContributionsDashboard: React.FC<ContributionsDashboardProps> = ({ onLogout, counties = [] }) => {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    county: 'all',
    confidence: 'all',
    hasPhoto: 'all'
  });
  const [stats, setStats] = useState({
    pending: 0,
    verified_today: 0,
    rejected: 0,
    total: 0
  });
  const { theme } = useTheme();

  // Safe array access with fallbacks
  const safeCounties = Array.isArray(counties) ? counties : [];
  const safeContributions = Array.isArray(contributions) ? contributions : [];

  const fetchContributions = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('iebc_office_contributions')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      if (filters.county !== 'all') {
        query = query.eq('submitted_county', filters.county);
      }
      if (filters.hasPhoto !== 'all') {
        if (filters.hasPhoto === 'yes') {
          query = query.not('image_public_url', 'is', null);
        } else {
          query = query.is('image_public_url', null);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setContributions(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching contributions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const { data: pendingData } = await supabase
        .from('iebc_office_contributions')
        .select('id')
        .eq('status', 'pending');

      const today = new Date().toISOString().split('T')[0];
      const { data: todayData } = await supabase
        .from('iebc_office_contributions')
        .select('id')
        .eq('status', 'verified')
        .gte('reviewed_at', today);

      const { data: rejectedData } = await supabase
        .from('iebc_office_contributions')
        .select('id')
        .eq('status', 'rejected');

      const { data: totalData } = await supabase
        .from('iebc_office_contributions')
        .select('id');

      setStats({
        pending: pendingData?.length || 0,
        verified_today: todayData?.length || 0,
        rejected: rejectedData?.length || 0,
        total: totalData?.length || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchContributions();
    fetchStats();

    // Refresh stats every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchContributions, fetchStats]);

  const handleVerify = async (contribution: Contribution) => {
    try {
      const { data, error } = await supabase
        .rpc('promote_contribution_to_office', {
          p_contribution_id: contribution.id,
          p_admin_id: 'admin_dashboard',
          p_office_data: {
            county: contribution.submitted_county,
            constituency: contribution.submitted_constituency,
            office_location: contribution.submitted_office_location,
            landmark: contribution.submitted_landmark,
            verification_source: 'admin_manual'
          }
        });

      if (error) throw error;
      
      // Refresh data
      await fetchContributions();
      await fetchStats();
      
      alert('Contribution verified successfully!');
    } catch (err: any) {
      console.error('Error verifying contribution:', err);
      alert('Failed to verify contribution: ' + err.message);
    }
  };

  const handleReject = async (contribution: Contribution) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status: 'rejected',
          review_notes: reason,
          reviewer_id: 'admin_dashboard',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', contribution.id);

      if (error) throw error;

      // Log rejection
      await supabase.from('verification_log').insert({
        contribution_id: contribution.id,
        action: 'rejected',
        actor: 'admin:dashboard',
        details: { reason }
      });

      await fetchContributions();
      await fetchStats();
      
      alert('Contribution rejected successfully!');
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
      // Get duplicate candidates
      const { data: duplicates } = await supabase
        .rpc('find_duplicate_offices', {
          p_lat: contribution.submitted_latitude,
          p_lng: contribution.submitted_longitude,
          p_name: contribution.submitted_office_location,
          p_radius_meters: 200
        });

      if (duplicates && duplicates.length > 0) {
        const duplicateList = duplicates.map((d: any) => 
          `${d.office_name} (${Math.round(d.distance_meters)}m away)`
        ).join('\n');

        const confirmMerge = confirm(
          `Merge this contribution with existing office?\n\nPotential duplicates:\n${duplicateList}\n\nClick OK to merge, Cancel to keep separate.`
        );

        if (confirmMerge) {
          // For now, just verify the contribution
          await handleVerify(contribution);
        }
      } else {
        alert('No suitable duplicates found for merging.');
      }
    } catch (err: any) {
      console.error('Error merging contribution:', err);
      alert('Failed to merge contribution: ' + err.message);
    }
  };

  const handleBulkAction = async (action: 'verify' | 'reject', contributionIds: number[]) => {
    const confirmMessage = action === 'verify' 
      ? `Are you sure you want to verify ${contributionIds.length} contributions?`
      : `Are you sure you want to reject ${contributionIds.length} contributions?`;

    if (!confirm(confirmMessage)) return;

    try {
      for (const id of contributionIds) {
        if (action === 'verify') {
          const contribution = safeContributions.find(c => c.id === id);
          if (contribution) {
            await handleVerify(contribution);
          }
        } else {
          const contribution = safeContributions.find(c => c.id === id);
          if (contribution) {
            await handleReject(contribution);
          }
        }
      }
      
      alert(`Successfully processed ${contributionIds.length} contributions!`);
    } catch (err: any) {
      console.error('Error in bulk action:', err);
      alert('Failed to process bulk action: ' + err.message);
    }
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
      {/* Header */}
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
              <div className="text-sm text-muted-foreground">
                Last updated: {new Date().toLocaleString()}
              </div>
              <button
                onClick={onLogout}
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

      {/* Stats */}
      <div 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-[10001]"
        style={{ zIndex: 10001 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Pending Review Stat */}
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

          {/* Verified Today Stat */}
          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Rejected Stat */}
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

          {/* Total Submissions Stat */}
          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Submissions</p>
                <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6 mb-6 relative z-[10001]">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary bg-background text-foreground"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
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
          </div>

          {/* Bulk Actions */}
          {safeContributions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-foreground">Bulk Actions:</span>
                <button
                  onClick={() => handleBulkAction('verify', safeContributions.map(c => c.id))}
                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
                >
                  Verify All
                </button>
                <button
                  onClick={() => handleBulkAction('reject', safeContributions.map(c => c.id))}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                  Reject All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
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

        {/* Contributions Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 relative z-[10001]">
          {safeContributions.map((contribution) => (
            <ContributionCard
              key={contribution.id}
              contribution={contribution}
              onVerify={handleVerify}
              onReject={handleReject}
              onRequestInfo={handleRequestInfo}
              onMerge={handleMerge}
            />
          ))}
        </div>

        {/* Empty State */}
        {safeContributions.length === 0 && !loading && (
          <div className="text-center py-12 relative z-[10001]">
            <svg className="w-12 h-12 text-muted-foreground mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-foreground mb-2">No contributions found</h3>
            <p className="text-muted-foreground">No submissions match your current filters.</p>
          </div>
        )}
      </div>

      {/* CSS for Z-Index Isolation */}
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
        
        /* Force all dashboard content above map */
        .contributions-dashboard > * {
          z-index: 10001 !important;
        }
      `}</style>
    </div>
  );
};

export default ContributionsDashboard;
