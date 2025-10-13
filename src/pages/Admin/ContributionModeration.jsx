import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

const ContributionModeration = () => {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchContributions();
    fetchStats();
  }, []);

  const fetchContributions = async () => {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContributions(data || []);
    } catch (error) {
      console.error('Error fetching contributions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .select('status');

      if (error) throw error;

      const stats = {
        pending: data.filter(c => c.status === 'pending').length,
        approved: data.filter(c => c.status === 'approved').length,
        rejected: data.filter(c => c.status === 'rejected').length
      };
      setStats(stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const approveContribution = async (contributionId) => {
    setIsProcessing(true);
    try {
      // Call the database function to approve the contribution
      const { data, error } = await supabase.rpc('approve_contribution', {
        contribution_id: contributionId,
        admin_user_id: 'admin' // In production, use actual admin ID
      });

      if (error) throw error;

      console.log('Contribution approved:', data);
      
      // Refresh data
      await fetchContributions();
      await fetchStats();
      
      // Close detail view if open
      setSelectedContribution(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error approving contribution:', error);
      alert('Error approving contribution: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const rejectContribution = async (contributionId) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status: 'rejected',
          review_notes: reviewNotes || 'Rejected by administrator',
          reviewed_at: new Date().toISOString(),
          reviewer_id: 'admin'
        })
        .eq('id', contributionId);

      if (error) throw error;
      
      // Refresh data
      await fetchContributions();
      await fetchStats();
      
      // Close detail view
      setSelectedContribution(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error rejecting contribution:', error);
      alert('Error rejecting contribution: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openContributionDetails = (contribution) => {
    setSelectedContribution(contribution);
    setReviewNotes(contribution.review_notes || '');
  };

  const closeContributionDetails = () => {
    setSelectedContribution(null);
    setReviewNotes('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Contribution Moderation
          </h1>
          <p className="text-gray-600">
            Review and manage IEBC office location contributions from users
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Contributions List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              All Contributions ({contributions.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {contributions.map((contribution) => (
              <motion.div
                key={contribution.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => openContributionDetails(contribution)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {contribution.submitted_office_location || 'New Office Location'}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        contribution.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : contribution.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {contribution.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">County:</span>{' '}
                        {contribution.submitted_county || 'Not specified'}
                      </div>
                      <div>
                        <span className="font-medium">Constituency:</span>{' '}
                        {contribution.submitted_constituency || 'Not specified'}
                      </div>
                      <div>
                        <span className="font-medium">Accuracy:</span>{' '}
                        ±{Math.round(contribution.submitted_accuracy_meters || 0)}m
                      </div>
                      <div>
                        <span className="font-medium">Submitted:</span>{' '}
                        {new Date(contribution.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {contribution.review_notes && (
                      <div className="mt-2">
                        <span className="font-medium text-sm text-gray-700">Review Notes:</span>{' '}
                        <span className="text-sm text-gray-600">{contribution.review_notes}</span>
                      </div>
                    )}
                  </div>

                  <div className="ml-4 flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {contributions.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 text-lg">No contributions found</p>
              <p className="text-gray-400 mt-1">User contributions will appear here once submitted</p>
            </div>
          )}
        </div>
      </div>

      {/* Contribution Detail Modal */}
      <AnimatePresence>
        {selectedContribution && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeContributionDetails} />

              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4">
                  <button
                    onClick={closeContributionDetails}
                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Contribution Details
                    </h3>

                    <div className="space-y-4">
                      {/* Location Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Office Location</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {selectedContribution.submitted_office_location || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">County</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {selectedContribution.submitted_county || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Constituency</label>
                          <p className="mt-1 text-sm text-gray-900">
                            {selectedContribution.submitted_constituency || 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Accuracy</label>
                          <p className="mt-1 text-sm text-gray-900">
                            ±{Math.round(selectedContribution.submitted_accuracy_meters || 0)} meters
                          </p>
                        </div>
                      </div>

                      {/* Coordinates */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Latitude</label>
                          <p className="mt-1 text-sm text-gray-900 font-mono">
                            {selectedContribution.submitted_latitude?.toFixed(6)}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Longitude</label>
                          <p className="mt-1 text-sm text-gray-900 font-mono">
                            {selectedContribution.submitted_longitude?.toFixed(6)}
                          </p>
                        </div>
                      </div>

                      {/* Image */}
                      {selectedContribution.image_public_url && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Submitted Photo</label>
                          <img
                            src={selectedContribution.image_public_url}
                            alt="Contribution"
                            className="max-w-full h-64 object-cover rounded-lg border border-gray-300"
                          />
                        </div>
                      )}

                      {/* Review Notes */}
                      <div>
                        <label htmlFor="reviewNotes" className="block text-sm font-medium text-gray-700 mb-2">
                          Review Notes
                        </label>
                        <textarea
                          id="reviewNotes"
                          rows={3}
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Add notes about this contribution..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  {selectedContribution.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => approveContribution(selectedContribution.id)}
                        disabled={isProcessing}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                      >
                        {isProcessing ? <LoadingSpinner size="small" /> : 'Approve Contribution'}
                      </button>
                      <button
                        type="button"
                        onClick={() => rejectContribution(selectedContribution.id)}
                        disabled={isProcessing}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                      >
                        {isProcessing ? <LoadingSpinner size="small" /> : 'Reject Contribution'}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={closeContributionDetails}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContributionModeration;
