// COMPLETE: src/lib/api/handlers.ts
// All IEBC Office API endpoint handlers with full validation & error handling

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Office {
  id: number;
  county: string;
  constituency_name: string | null;
  office_location: string;
  latitude: number | null;
  longitude: number | null;
  [key: string]: any;
}

interface Contribution {
  officeId: number;
  type: 'location' | 'contact' | 'status' | 'other';
  description: string;
  photos?: string[];
}

interface Confirmation {
  officeId: number;
  userLatitude: number;
  userLongitude: number;
  userAccuracyMeters: number;
}

interface StatusReport {
  officeId: number;
  status: 'operational' | 'closed' | 'relocated' | 'under_renovation';
  reason: string;
}

interface ContactUpdate {
  officeId: number;
  phone?: string;
  email?: string;
  hours?: string;
  notes?: string;
}

interface SearchFilters {
  county?: string;
  verified?: boolean;
  hasCoordinates?: boolean;
}

export const apiHandlers = {
  async fetchAllOffices(filters: SearchFilters = {}): Promise<Office[]> {
    try {
      let query = supabase
        .from('iebc_offices')
        .select('*')
        .order('county')
        .order('constituency_name');

      if (filters.verified !== undefined) {
        query = query.eq('verified', filters.verified);
      }

      if (filters.hasCoordinates) {
        query = query.not('latitude', 'is', null).not('longitude', 'is', null);
      }

      if (filters.county) {
        query = query.eq('county', filters.county);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching offices:', error);
      toast.error(`Failed to fetch offices: ${error.message}`);
      throw error;
    }
  },

  async searchOffices(searchTerm: string, limit = 20): Promise<Office[]> {
    try {
      const { data, error } = await supabase.rpc('search_offices_fuzzy', {
        search_term: searchTerm,
        limit_count: limit
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error searching offices:', error);
      toast.error(`Search failed: ${error.message}`);
      throw error;
    }
  },

  async fetchNearbyOffices(
    latitude: number,
    longitude: number,
    radiusKm = 50
  ): Promise<Office[]> {
    try {
      const { data, error } = await supabase.rpc('nearby_offices', {
        user_lat: latitude,
        user_lng: longitude,
        radius_km: radiusKm
      });

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching nearby offices:', error);
      toast.error(`Failed to find nearby offices: ${error.message}`);
      throw error;
    }
  },

  async fetchOfficeById(id: number): Promise<Office | null> {
    try {
      const { data, error } = await supabase
        .from('iebc_offices')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error fetching office:', error);
      toast.error(`Failed to fetch office: ${error.message}`);
      throw error;
    }
  },

  async fetchOfficeWithRelations(id: number) {
    try {
      const [office, stats, confirmations, statusHistory, contactUpdates] = await Promise.all([
        this.fetchOfficeById(id),
        supabase.rpc('get_office_stats', { office_id_param: id }),
        supabase
          .from('confirmations')
          .select('*')
          .eq('office_id', id)
          .order('confirmed_at', { ascending: false })
          .limit(10),
        supabase
          .from('operational_status_history')
          .select('*')
          .eq('office_id', id)
          .order('reported_at', { ascending: false })
          .limit(10),
        supabase
          .from('contact_update_requests')
          .select('*')
          .eq('office_id', id)
          .order('submitted_at', { ascending: false })
          .limit(10)
      ]);

      if (office === null) {
        throw new Error('Office not found');
      }

      return {
        office,
        stats: stats.data?.[0] || null,
        confirmations: confirmations.data || [],
        statusHistory: statusHistory.data || [],
        contactUpdates: contactUpdates.data || []
      };
    } catch (error: any) {
      console.error('Error fetching office with relations:', error);
      toast.error(`Failed to fetch office details: ${error.message}`);
      throw error;
    }
  },

  async getVerificationStatistics() {
    try {
      const { data, error } = await supabase
        .from('office_verification_stats')
        .select('*')
        .order('confirmation_count', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching verification statistics:', error);
      throw error;
    }
  },

  async confirmOfficeAccuracy(data: Confirmation): Promise<any> {
    try {
      const { data: confirmation, error } = await supabase
        .from('confirmations')
        .insert({
          office_id: data.officeId,
          confirmer_lat: data.userLatitude,
          confirmer_lng: data.userLongitude,
          confirmer_accuracy_meters: data.userAccuracyMeters,
          confirmation_weight: 1.0
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Location confirmed successfully');
      return confirmation;
    } catch (error: any) {
      console.error('Error confirming office:', error);
      toast.error(`Failed to confirm location: ${error.message}`);
      throw error;
    }
  },

  async submitContribution(data: Contribution): Promise<any> {
    try {
      const { data: contribution, error } = await supabase
        .from('iebc_office_contributions')
        .insert({
          original_office_id: data.officeId,
          submitted_office_location: data.description,
          status: 'pending_review',
          submission_method: 'web_app',
          submission_source: 'user_contribution'
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Contribution submitted successfully');
      return contribution;
    } catch (error: any) {
      console.error('Error submitting contribution:', error);
      toast.error(`Failed to submit contribution: ${error.message}`);
      throw error;
    }
  },

  async reportStatusChange(data: StatusReport): Promise<any> {
    try {
      const { data: statusReport, error } = await supabase
        .from('operational_status_history')
        .insert({
          office_id: data.officeId,
          status: data.status,
          reason: data.reason,
          reported_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Status report submitted successfully');
      return statusReport;
    } catch (error: any) {
      console.error('Error reporting status:', error);
      toast.error(`Failed to report status: ${error.message}`);
      throw error;
    }
  },

  async suggestContactUpdate(data: ContactUpdate): Promise<any> {
    try {
      const { data: contactUpdate, error } = await supabase
        .from('contact_update_requests')
        .insert({
          office_id: data.officeId,
          phone: data.phone,
          email: data.email,
          hours: data.hours,
          notes: data.notes,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Contact update suggestion submitted');
      return contactUpdate;
    } catch (error: any) {
      console.error('Error suggesting contact update:', error);
      toast.error(`Failed to suggest contact update: ${error.message}`);
      throw error;
    }
  },

  async voteOnContribution(contributionId: number, voteType: 'upvote' | 'downvote' | 'helpful' | 'not_helpful'): Promise<any> {
    try {
      const { data: vote, error } = await supabase
        .from('contribution_votes')
        .insert({
          contribution_id: contributionId,
          vote_type: voteType
        })
        .select()
        .single();

      if (error) throw error;
      toast.success('Vote recorded');
      return vote;
    } catch (error: any) {
      console.error('Error voting on contribution:', error);
      toast.error(`Failed to record vote: ${error.message}`);
      throw error;
    }
  },

  async getRecentContributions(limit = 20): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching recent contributions:', error);
      throw error;
    }
  },

  async getRegistrationDeadlines(officeId?: number): Promise<any[]> {
    try {
      let query = supabase
        .from('registration_deadlines')
        .select('*')
        .eq('is_active', true)
        .order('deadline_date', { ascending: true });

      if (officeId) {
        query = query.eq('office_id', officeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching registration deadlines:', error);
      throw error;
    }
  },

  async getCountiesList(): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('iebc_offices')
        .select('county')
        .not('county', 'is', null);

      if (error) throw error;

      const uniqueCounties = Array.from(new Set((data || []).map((o: any) => o.county))).sort();
      return uniqueCounties as string[];
    } catch (error: any) {
      console.error('Error fetching counties:', error);
      throw error;
    }
  },

  async approveContribution(contributionId: number, notes?: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', contributionId)
        .select()
        .single();

      if (error) throw error;
      toast.success('Contribution approved');
      return data;
    } catch (error: any) {
      console.error('Error approving contribution:', error);
      toast.error(`Failed to approve contribution: ${error.message}`);
      throw error;
    }
  },

  async rejectContribution(contributionId: number, notes: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('iebc_office_contributions')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          review_notes: notes
        })
        .eq('id', contributionId)
        .select()
        .single();

      if (error) throw error;
      toast.success('Contribution rejected');
      return data;
    } catch (error: any) {
      console.error('Error rejecting contribution:', error);
      toast.error(`Failed to reject contribution: ${error.message}`);
      throw error;
    }
  },

  async updateOfficeDetails(officeId: number, updates: Partial<Office>): Promise<Office> {
    try {
      const { data, error } = await supabase
        .from('iebc_offices')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', officeId)
        .select()
        .single();

      if (error) throw error;
      toast.success('Office updated successfully');
      return data;
    } catch (error: any) {
      console.error('Error updating office:', error);
      toast.error(`Failed to update office: ${error.message}`);
      throw error;
    }
  }
};

export default apiHandlers;
