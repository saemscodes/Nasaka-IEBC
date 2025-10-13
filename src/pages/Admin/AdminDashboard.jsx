import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/IEBCOffice/LoadingSpinner';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalContributions: 0,
    pendingContributions: 0,
    approvedContributions: 0,
    rejectedContributions: 0,
    totalOffices: 0,
    verifiedOffices: 0
  });
  const [recentContributions, setRecentContributions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch contribution stats
      const { data: contributions, error: contributionsError } = await supabase
        .from('iebc_office_contributions')
        .select('status');

      if (contributionsError) throw contributionsError;

      // Fetch office stats
      const { data: offices, error: officesError } = await supabase
        .from('iebc_offices')
        .select('verified_latitude, verified_longitude');

      if (officesError) throw officesError;

      // Fetch recent contributions
      const { data: recent, error: recentError } = await supabase
        .from('iebc_office_contributions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) throw recentError;

      // Calculate stats
      const contributionStats = {
        total: contributions.length,
        pending: contributions.filter(c => c.status === 'pending').length,
        approved: contributions.filter(c => c.status === 'approved').length,
        rejected: contributions.filter(c => c.status === 'rejected').length
      };

      const officeStats = {
        total: offices.length,
        verified: offices.filter(o => o.verified_latitude !== null).length
      };

      setStats({
        totalContributions: contributionStats.total,
        pendingContributions: contributionStats.pending,
        approvedContributions: contributionStats.approved,
        rejectedContributions: contributionStats.rejected,
        totalOffices: officeStats.total,
        verifiedOffices: officeStats.verified
      });

      setRecentContributions(recent || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600">
            Overview of IEBC office location contributions and verification status
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Contributions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contributions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalContributions}</p>
              </div>
            </div>
          </motion.div>

          {/* Pending Review */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingContributions}</p>
              </div>
            </div>
          </motion.div>

          {/* Approved */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approvedContributions}</p>
              </div>
            </div>
          </motion.div>

          {/* Verified Offices */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-lg shadow p-6"
          >
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Verified Offices</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.verifiedOffices} / {stats.totalOffices}
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Moderate Contributions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Moderate Contributions
                </h3>
                <p className="text-gray-600 mb-4">
                  Review and approve or reject user-submitted IEBC office locations.
                </p>
                <Link
                  to="/admin/contributions"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Review Contributions
                </Link>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* View All Offices */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  View All Offices
                </h3>
                <p className="text-gray-600 mb-4">
                  Browse all IEBC offices and their verification status on the map.
                </p>
                <Link
                  to="/iebc-office/map"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  View Map
                </Link>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Contributions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Contributions
            </h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentContributions.map((contribution) => (
              <div key={contribution.id} className="p-6">
                <div className="flex items-center justify-between">
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
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">County:</span> {contribution.submitted_county || 'Not specified'} • 
                      <span className="font-medium ml-2">Submitted:</span> {new Date(contribution.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Link
                    to="/admin/contributions"
                    className="ml-4 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200"
                  >
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {recentContributions.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 text-lg">No contributions yet</p>
              <p className="text-gray-400 mt-1">User contributions will appear here once submitted</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
