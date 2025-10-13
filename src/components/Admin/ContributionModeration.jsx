import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const ContributionModeration = () => {
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const { error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status,
          review_notes: notes,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      // Refresh the list
      fetchContributions();
    } catch (error) {
      console.error('Error updating contribution:', error);
    }
  };

  if (loading) {
    return <div>Loading contributions...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Contribution Moderation</h1>
      
      <div className="space-y-4">
        {contributions.map((contribution) => (
          <div key={contribution.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold">
                  {contribution.submitted_office_location || 'Unknown Office'}
                </h3>
                <p className="text-sm text-gray-600">
                  {contribution.submitted_county}, {contribution.submitted_constituency}
                </p>
                <p className="text-sm">
                  Accuracy: ±{Math.round(contribution.submitted_accuracy_meters)}m
                </p>
              </div>
              <span className={`px-2 py-1 rounded text-xs ${
                contribution.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                contribution.status === 'approved' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {contribution.status}
              </span>
            </div>

            {contribution.image_public_url && (
              <div className="mb-3">
                <img
                  src={contribution.image_public_url}
                  alt="Contribution"
                  className="max-w-xs rounded border"
                />
              </div>
            )}

            <div className="flex space-x-2">
              {contribution.status === 'pending' && (
                <>
                  <button
                    onClick={() => updateContributionStatus(contribution.id, 'approved')}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => updateContributionStatus(contribution.id, 'rejected')}
                    className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContributionModeration;
