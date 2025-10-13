import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';

const ContributionModeration = () => {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const { logout } = useAdminAuth();

  useEffect(() => {
    fetchContributions();
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

  const updateContributionStatus = async (id, status, notes = '') => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status,
          review_notes: notes,
          reviewed_at: new Date().toISOString(),
          reviewer_id: 'admin'
        })
        .eq('id', id);

      if (error) throw error;
      
      await fetchContributions();
      setSelectedContribution(null);
      setReviewNotes('');
    } catch (error) {
      console.error('Error updating contribution:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const approveContribution = async (contribution) => {
    try {
      await updateContributionStatus(contribution.id, 'approved', reviewNotes);
      
      if (contribution.original_office_id) {
        const { error: updateError } = await supabase
          .from('iebc_offices')
          .update({
            verified_latitude: contribution.submitted_latitude,
            verified_longitude: contribution.submitted_longitude,
            verified_at: new Date().toISOString(),
            verifier_id: 'admin',
            contributor_image_url: contribution.image_public_url,
            geocode_method: 'crowdsource',
            geocode_confidence: 0.95
          })
          .eq('id', contribution.original_office_id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('iebc_offices')
          .insert({
            county: contribution.submitted_county,
            constituency_name: contribution.submitted_constituency,
            office_location: contribution.submitted_office_location,
            latitude: contribution.submitted_latitude,
            longitude: contribution.submitted_longitude,
            verified_latitude: contribution.submitted_latitude,
            verified_longitude: contribution.submitted_longitude,
            verified_at: new Date().toISOString(),
            verifier_id: 'admin',
            contributor_image_url: contribution.image_public_url,
            geocode_method: 'crowdsource',
            geocode_confidence: 0.95,
            verified: true
          });

        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error approving contribution:', error);
    }
  };

  const rejectContribution = async (contribution) => {
    await updateContributionStatus(contribution.id, 'rejected', reviewNotes);
  };

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded text-xs font-medium";
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'approved':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Contribution Moderation</h1>
              </div>
              <nav className="ml-6 flex space-x-4">
                <Link to="/admin" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </Link>
                <Link to="/admin/contributions" className="text-gray-900 px-3 py-2 rounded-md text-sm font-medium bg-gray-100">
                  Contributions
                </Link>
                <Link to="/admin/analytics" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Analytics
                </Link>
              </nav>
            </div>
            <button
              onClick={logout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Location Contributions ({contributions.length})
                </h2>
                <div className="flex space-x-2">
                  <span className="text-sm text-gray-600">
                    Pending: {contributions.filter(c => c.status === 'pending').length}
                  </span>
                  <span className="text-sm text-green-600">
                    Approved: {contributions.filter(c => c.status === 'approved').length}
                  </span>
                  <span className="text-sm text-red-600">
                    Rejected: {contributions.filter(c => c.status === 'rejected').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden">
              {contributions.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-gray-500">No contributions found</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {contributions.map((contribution) => (
                    <div key={contribution.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {contribution.submitted_office_location || 'New Office Location'}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-3">
                            <div>
                              <span className="font-medium">County:</span> {contribution.submitted_county || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Constituency:</span> {contribution.submitted_constituency || 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Accuracy:</span> ±{Math.round(contribution.submitted_accuracy_meters)}m
                            </div>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Coordinates:</span> {contribution.submitted_latitude?.toFixed(6)}, {contribution.submitted_longitude?.toFixed(6)}
                          </div>
                          {contribution.submitted_landmark && (
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">Landmark:</span> {contribution.submitted_landmark}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className={getStatusBadge(contribution.status)}>
                            {contribution.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(contribution.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {contribution.image_public_url && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Submitted Photo:</p>
                          <img
                            src={contribution.image_public_url}
                            alt="Contribution"
                            className="max-w-xs rounded-lg border shadow-sm"
                          />
                        </div>
                      )}

                      {contribution.review_notes && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">Review Notes:</p>
                          <p className="text-sm text-gray-600">{contribution.review_notes}</p>
                        </div>
                      )}

                      <div className="flex justify-between items-center">
                        <div className="flex space-x-3">
                          {contribution.status === 'pending' && (
                            <>
                              <button
                                onClick={() => setSelectedContribution(contribution)}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                              >
                                Review
                              </button>
                              <button
                                onClick={() => approveContribution(contribution)}
                                disabled={actionLoading === contribution.id}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                              >
                                {actionLoading === contribution.id ? (
                                  <>
                                    <LoadingSpinner size="small" className="mr-2" />
                                    Approving...
                                  </>
                                ) : (
                                  'Approve'
                                )}
                              </button>
                              <button
                                onClick={() => rejectContribution(contribution)}
                                disabled={actionLoading === contribution.id}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {actionLoading === contribution.id ? 'Rejecting...' : 'Reject'}
                              </button>
                            </>
                          )}
                        </div>
                        {contribution.reviewed_at && (
                          <span className="text-xs text-gray-500">
                            Reviewed: {new Date(contribution.reviewed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {selectedContribution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Review Contribution</h3>
                <button
                  onClick={() => setSelectedContribution(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Review Notes
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="Add notes about this contribution (optional)..."
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => {
                      approveContribution(selectedContribution);
                    }}
                    disabled={actionLoading === selectedContribution.id}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                  >
                    {actionLoading === selectedContribution.id ? (
                      <>
                        <LoadingSpinner size="small" className="mr-2" />
                        Approving...
                      </>
                    ) : (
                      'Approve Contribution'
                    )}
                  </button>
                  <button
                    onClick={() => {
                      rejectContribution(selectedContribution);
                    }}
                    disabled={actionLoading === selectedContribution.id}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === selectedContribution.id ? 'Rejecting...' : 'Reject Contribution'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContributionModeration;
