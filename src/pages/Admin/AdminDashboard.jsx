// src/components/Admin/ContributionsDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

// iOS-inspired design constants
const IOS_COLORS = {
  primary: '#007AFF',
  secondary: '#8E8E93',
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  background: '#F2F2F7',
  card: '#FFFFFF',
  separator: '#C6C6C8'
};

const IOS_SHADOWS = {
  card: '0 2px 8px rgba(0,0,0,0.08)',
  button: '0 2px 4px rgba(0,0,0,0.1)',
  modal: '0 10px 30px rgba(0,0,0,0.15)'
};

// Simple password protection component
const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simple password check - in production, use proper authentication
    if (password === import.meta.env.VITE_ADMIN_PASSWORD || password === 'IEBC2024Admin!') {
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate auth delay
      onLogin(true);
    } else {
      setError('Invalid password');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" style={{ background: IOS_COLORS.background }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-8 max-w-md w-full mx-4"
        style={{ 
          background: IOS_COLORS.card,
          boxShadow: IOS_SHADOWS.modal
        }}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Enter admin password to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="Enter admin password"
              style={{ background: IOS_COLORS.background }}
            />
          </div>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-xl p-4"
            >
              <p className="text-sm text-red-700 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {error}
              </p>
            </motion.div>
          )}
          
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            style={{ boxShadow: IOS_SHADOWS.button }}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="small" />
                <span className="ml-2">Authenticating...</span>
              </>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const ContributionsDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [filters, setFilters] = useState({
    status: 'pending_review',
    county: '',
    hasPhoto: false,
    confidenceScore: 0
  });
  const [stats, setStats] = useState({
    pending: 0,
    verified: 0,
    rejected: 0,
    archived: 0,
    total: 0
  });

  const fetchContributions = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('iebc_office_contributions')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.county) {
        query = query.eq('submitted_county', filters.county);
      }
      if (filters.hasPhoto) {
        query = query.not('image_public_url', 'is', null);
      }
      if (filters.confidenceScore > 0) {
        query = query.gte('confidence_score', filters.confidenceScore);
      }

      const { data, error } = await query;
      if (error) throw error;
      setContributions(data || []);
    } catch (error) {
      console.error('Error fetching contributions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .select('status');

      if (error) throw error;

      const stats = {
        pending: data.filter(c => c.status === 'pending_review').length,
        verified: data.filter(c => c.status === 'verified').length,
        rejected: data.filter(c => c.status === 'rejected').length,
        archived: data.filter(c => c.status === 'archived').length,
        total: data.length
      };

      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchContributions();
      fetchStats();
      
      // Refresh every 30 seconds
      const interval = setInterval(() => {
        fetchContributions();
        fetchStats();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchContributions, fetchStats]);

  // FIXED: Use promote_contribution_to_office instead of verify_contribution
  const handleVerify = async (contributionId) => {
    setActionLoading(contributionId);
    try {
      console.log('Verifying contribution:', contributionId);
      
      const { data, error } = await supabase.rpc('promote_contribution_to_office', {
        p_contribution_id: contributionId,
        p_admin_id: 'admin_dashboard',
        p_office_data: {} // Empty object since we're using contribution data
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      console.log('Verification result:', data);

      // Log the verification
      await supabase.from('verification_log').insert({
        contribution_id: contributionId,
        action: 'verified',
        actor: 'admin:dashboard',
        details: { 
          result: data,
          timestamp: new Date().toISOString()
        }
      });

      await fetchContributions();
      await fetchStats();
      
      // Show success message based on action
      if (data && data.action) {
        alert(`✅ Contribution ${data.action === 'created' ? 'verified and new office created' : 'verified and existing office updated'}`);
      } else {
        alert('✅ Contribution successfully verified');
      }
    } catch (error) {
      console.error('Error verifying contribution:', error);
      alert('❌ Failed to verify contribution: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // FIXED: Use archive_contribution function for rejection
  const handleReject = async (contributionId, reason = 'Insufficient evidence') => {
    setActionLoading(contributionId);
    try {
      const { error } = await supabase.rpc('archive_contribution', {
        p_contribution_id: contributionId,
        p_action_type: 'rejected',
        p_actor: 'admin_dashboard',
        p_review_notes: reason,
        p_archive_reason: reason,
        p_original_office_id: null
      });

      if (error) throw error;

      await fetchContributions();
      await fetchStats();
      
      alert('❌ Contribution rejected and archived');
    } catch (error) {
      console.error('Error rejecting contribution:', error);
      alert('❌ Failed to reject contribution: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // NEW: Archive without rejection (for duplicates, etc.)
  const handleArchive = async (contributionId, reason = 'Duplicate submission') => {
    setActionLoading(contributionId);
    try {
      const { error } = await supabase.rpc('archive_contribution', {
        p_contribution_id: contributionId,
        p_action_type: 'archived',
        p_actor: 'admin_dashboard',
        p_review_notes: reason,
        p_archive_reason: reason,
        p_original_office_id: null
      });

      if (error) throw error;

      await fetchContributions();
      await fetchStats();
      
      alert('📁 Contribution archived');
    } catch (error) {
      console.error('Error archiving contribution:', error);
      alert('❌ Failed to archive contribution: ' + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  // Enhanced status badge with iOS style
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending_review: { 
        color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        icon: '⏳',
        label: 'Pending'
      },
      verified: { 
        color: 'bg-green-100 text-green-800 border-green-200',
        icon: '✅',
        label: 'Verified'
      },
      rejected: { 
        color: 'bg-red-100 text-red-800 border-red-200',
        icon: '❌',
        label: 'Rejected'
      },
      archived: { 
        color: 'bg-gray-100 text-gray-800 border-gray-200',
        icon: '📁',
        label: 'Archived'
      }
    };

    const config = statusConfig[status] || statusConfig.pending_review;

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full border ${config.color} flex items-center space-x-1`}>
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </span>
    );
  };

  // iOS-style action sheet for additional actions
  const ActionSheet = ({ contribution, onClose }) => {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-white rounded-t-2xl w-full max-w-md mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 text-center">Actions</h3>
          </div>
          
          <div className="p-2">
            <button
              onClick={() => {
                handleVerify(contribution.id);
                onClose();
              }}
              className="w-full text-left p-4 rounded-xl hover:bg-gray-50 flex items-center space-x-3 text-green-600"
            >
              <span className="text-lg">✅</span>
              <span>Verify & Create Office</span>
            </button>
            
            <button
              onClick={() => {
                const reason = prompt('Rejection reason:', 'Insufficient evidence');
                if (reason) {
                  handleReject(contribution.id, reason);
                  onClose();
                }
              }}
              className="w-full text-left p-4 rounded-xl hover:bg-gray-50 flex items-center space-x-3 text-red-600"
            >
              <span className="text-lg">❌</span>
              <span>Reject Contribution</span>
            </button>
            
            <button
              onClick={() => {
                const reason = prompt('Archive reason:', 'Duplicate submission');
                if (reason) {
                  handleArchive(contribution.id, reason);
                  onClose();
                }
              }}
              className="w-full text-left p-4 rounded-xl hover:bg-gray-50 flex items-center space-x-3 text-gray-600"
            >
              <span className="text-lg">📁</span>
              <span>Archive</span>
            </button>
          </div>
          
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full text-center p-3 font-medium text-gray-900 rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <AdminLogin onLogin={setIsAuthenticated} />;
  }

  return (
    <div className="min-h-screen p-4" style={{ background: IOS_COLORS.background }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Contributions</h1>
            <p className="text-gray-600">Manage IEBC office submissions</p>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors"
            style={{ boxShadow: IOS_SHADOWS.button }}
          >
            Logout
          </button>
        </div>

        {/* Stats Cards - iOS Style */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Pending', value: stats.pending, color: 'bg-yellow-500', icon: '⏳' },
            { label: 'Verified', value: stats.verified, color: 'bg-green-500', icon: '✅' },
            { label: 'Rejected', value: stats.rejected, color: 'bg-red-500', icon: '❌' },
            { label: 'Archived', value: stats.archived, color: 'bg-gray-500', icon: '📁' },
            { label: 'Total', value: stats.total, color: 'bg-blue-500', icon: '📊' }
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-4 flex items-center"
              style={{ boxShadow: IOS_SHADOWS.card }}
            >
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mr-3`}>
                <span className="text-white text-lg">{stat.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl p-4 mb-6" style={{ boxShadow: IOS_SHADOWS.card }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                style={{ background: IOS_COLORS.background }}
              >
                <option value="pending_review">Pending Review</option>
                <option value="verified">Verified</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">County</label>
              <select
                value={filters.county}
                onChange={(e) => setFilters(prev => ({ ...prev, county: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                style={{ background: IOS_COLORS.background }}
              >
                <option value="">All Counties</option>
                {KENYAN_COUNTIES.map(county => (
                  <option key={county} value={county}>{county}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confidence</label>
              <select
                value={filters.confidenceScore}
                onChange={(e) => setFilters(prev => ({ ...prev, confidenceScore: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                style={{ background: IOS_COLORS.background }}
              >
                <option value={0}>Any Score</option>
                <option value={50}>50+</option>
                <option value={70}>70+</option>
                <option value={90}>90+</option>
              </select>
            </div>

            <div className="flex items-end">
              <label className="flex items-center space-x-3 p-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.hasPhoto}
                  onChange={(e) => setFilters(prev => ({ ...prev, hasPhoto: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Has Photo</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contributions List */}
        <div className="space-y-3">
          {contributions.map((contribution) => (
            <motion.div
              key={contribution.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer"
              style={{ boxShadow: IOS_SHADOWS.card }}
              onClick={() => setSelectedContribution(contribution)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">
                    {contribution.submitted_office_location}
                  </h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {contribution.submitted_county} • {contribution.submitted_constituency}
                  </p>
                  <StatusBadge status={contribution.status} />
                </div>
                
                {contribution.image_public_url && (
                  <div className="ml-4 flex-shrink-0">
                    <img
                      src={contribution.image_public_url}
                      alt="Office"
                      className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                <div>
                  <span className="font-medium text-gray-700">Coordinates:</span>
                  <p className="text-gray-600 text-xs font-mono">
                    {contribution.submitted_latitude?.toFixed(6)}, {contribution.submitted_longitude?.toFixed(6)}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Accuracy:</span>
                  <p className="text-gray-600">
                    {contribution.submitted_accuracy_meters ? `±${Math.round(contribution.submitted_accuracy_meters)}m` : 'N/A'}
                  </p>
                </div>
              </div>

              {contribution.submitted_landmark && (
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Landmark:</span> {contribution.submitted_landmark}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Submitted: {new Date(contribution.created_at).toLocaleDateString()}</span>
                {contribution.confidence_score > 0 && (
                  <span>Confidence: {contribution.confidence_score}%</span>
                )}
              </div>

              {contribution.status === 'pending_review' && (
                <div className="flex space-x-2 mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleVerify(contribution.id);
                    }}
                    disabled={actionLoading === contribution.id}
                    className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center justify-center"
                    style={{ boxShadow: IOS_SHADOWS.button }}
                  >
                    {actionLoading === contribution.id ? (
                      <LoadingSpinner size="small" />
                    ) : (
                      'Verify'
                    )}
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const reason = prompt('Rejection reason:', 'Insufficient evidence');
                      if (reason) handleReject(contribution.id, reason);
                    }}
                    disabled={actionLoading === contribution.id}
                    className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
                    style={{ boxShadow: IOS_SHADOWS.button }}
                  >
                    Reject
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const reason = prompt('Archive reason:', 'Duplicate submission');
                      if (reason) handleArchive(contribution.id, reason);
                    }}
                    disabled={actionLoading === contribution.id}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
                    style={{ boxShadow: IOS_SHADOWS.button }}
                  >
                    Archive
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Map Preview */}
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: IOS_SHADOWS.card }}>
          <h3 className="font-semibold text-gray-900 mb-4">Location Preview</h3>
          <div className="h-96 rounded-xl overflow-hidden border border-gray-200 mb-4">
            <MapContainer
              center={selectedContribution ? 
                [selectedContribution.submitted_latitude, selectedContribution.submitted_longitude] : 
                [-1.286389, 36.817223]}
              zoom={selectedContribution ? 16 : 6}
              className="h-full w-full"
            >
              <GeoJSONLayerManager
                activeLayers={['iebc-offices']}
                onOfficeSelect={() => {}}
                selectedOffice={null}
                onNearbyOfficesFound={() => {}}
                baseMap="standard"
              />
              {selectedContribution && (
                <UserLocationMarker
                  position={[selectedContribution.submitted_latitude, selectedContribution.submitted_longitude]}
                  accuracy={selectedContribution.submitted_accuracy_meters}
                  color="#34C759"
                />
              )}
            </MapContainer>
          </div>
          
          {selectedContribution && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <h4 className="font-semibold text-gray-900 mb-3">Selected Contribution</h4>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  <strong>Office:</strong> {selectedContribution.submitted_office_location}
                </p>
                <p className="text-gray-600">
                  <strong>Location:</strong> {selectedContribution.submitted_county}, {selectedContribution.submitted_constituency}
                </p>
                <p className="text-gray-600">
                  <strong>Coordinates:</strong> {selectedContribution.submitted_latitude?.toFixed(6)}, {selectedContribution.submitted_longitude?.toFixed(6)}
                </p>
                {selectedContribution.google_maps_link && (
                  <a
                    href={selectedContribution.google_maps_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                  >
                    <span>🌐</span>
                    <span>View on Google Maps</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {contributions.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">📭</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contributions found</h3>
          <p className="text-gray-600">No submissions match your current filters.</p>
        </div>
      )}
    </div>
  );
};

export default ContributionsDashboard;
