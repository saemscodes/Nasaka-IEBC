// src/components/Admin/ContributionsDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import MapContainer from '@/components/IEBCOffice/MapContainer';
import GeoJSONLayerManager from '@/components/IEBCOffice/GeoJSONLayerManager';
import UserLocationMarker from '@/components/IEBCOffice/UserLocationMarker';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

// Simple password protection component
const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simple password check - in production, use proper authentication
    if (password === import.meta.env.VITE_ADMIN_PASSWORD || password === 'IEBC2024Admin!') {
      onLogin(true);
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Enter admin password to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter admin password"
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Access Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

const ContributionsDashboard = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [filters, setFilters] = useState({
    status: 'pending',
    county: '',
    hasPhoto: false,
    confidenceScore: 0
  });
  const [stats, setStats] = useState({
    pending: 0,
    verified: 0,
    rejected: 0,
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
        pending: data.filter(c => c.status === 'pending').length,
        verified: data.filter(c => c.status === 'verified').length,
        rejected: data.filter(c => c.status === 'rejected').length,
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
    }
  }, [isAuthenticated, fetchContributions, fetchStats]);

  const handleVerify = async (contributionId) => {
    try {
      const { data, error } = await supabase.rpc('promote_contribution_to_office', {
        p_contribution_id: contributionId,
        p_admin_id: 'admin_dashboard',
        p_office_data: {}
      });

      if (error) throw error;

      await fetchContributions();
      await fetchStats();
      
      alert('Contribution successfully verified and added to database');
    } catch (error) {
      console.error('Error verifying contribution:', error);
      alert('Failed to verify contribution: ' + error.message);
    }
  };

  const handleReject = async (contributionId, reason) => {
    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status: 'rejected',
          review_notes: reason,
          reviewer_id: 'admin_dashboard',
          reviewed_at: new Date().toISOString()
        })
        .eq('id', contributionId);

      if (error) throw error;

      // Log rejection
      await supabase.from('verification_log').insert({
        contribution_id: contributionId,
        action: 'rejected',
        actor: 'admin:dashboard',
        details: { reason }
      });

      await fetchContributions();
      await fetchStats();
      
      alert('Contribution rejected');
    } catch (error) {
      console.error('Error rejecting contribution:', error);
      alert('Failed to reject contribution: ' + error.message);
    }
  };

  const StatusBadge = ({ status }) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      verified: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      auto_verified: 'bg-blue-100 text-blue-800'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <AdminLogin onLogin={setIsAuthenticated} />;
  }

  if (loading && contributions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Contributions Dashboard</h1>
            <p className="text-gray-600">Manage and verify IEBC office location submissions</p>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              <p className="text-sm text-gray-600">Pending Review</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.verified}</p>
              <p className="text-sm text-gray-600">Verified</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
              <p className="text-sm text-gray-600">Rejected</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Submissions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="auto_verified">Auto Verified</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
            <select
              value={filters.county}
              onChange={(e) => setFilters(prev => ({ ...prev, county: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Counties</option>
              {KENYAN_COUNTIES.map(county => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confidence Score</label>
            <select
              value={filters.confidenceScore}
              onChange={(e) => setFilters(prev => ({ ...prev, confidenceScore: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={0}>Any Score</option>
              <option value={50}>50+</option>
              <option value={70}>70+</option>
              <option value={90}>90+</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-2">
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

      {/* Contributions List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="space-y-4">
          {contributions.map((contribution) => (
            <motion.div
              key={contribution.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {contribution.submitted_office_location}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {contribution.submitted_county} • {contribution.submitted_constituency}
                    </p>
                  </div>
                  <StatusBadge status={contribution.status} />
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="font-medium text-gray-700">Coordinates:</span>
                    <p className="text-gray-600">
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

                {contribution.image_public_url && (
                  <div className="mb-3">
                    <img
                      src={contribution.image_public_url}
                      alt="Office photo"
                      className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Submitted: {new Date(contribution.created_at).toLocaleDateString()}</span>
                  {contribution.confidence_score > 0 && (
                    <span>Confidence: {contribution.confidence_score}%</span>
                  )}
                </div>

                {contribution.status === 'pending' && (
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => handleVerify(contribution.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleReject(contribution.id, 'Insufficient evidence')}
                      className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => setSelectedContribution(contribution)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Details
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Map Preview */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Location Preview</h3>
          <div className="h-96 rounded-lg overflow-hidden border border-gray-200">
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
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Selected Contribution</h4>
              <p className="text-sm text-gray-600">
                <strong>Office:</strong> {selectedContribution.submitted_office_location}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Location:</strong> {selectedContribution.submitted_county}, {selectedContribution.submitted_constituency}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Coordinates:</strong> {selectedContribution.submitted_latitude?.toFixed(6)}, {selectedContribution.submitted_longitude?.toFixed(6)}
              </p>
              {selectedContribution.google_maps_link && (
                <a
                  href={selectedContribution.google_maps_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  View on Google Maps
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {contributions.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contributions found</h3>
          <p className="text-gray-600">No submissions match your current filters.</p>
        </div>
      )}
    </div>
  );
};

export default ContributionsDashboard;
