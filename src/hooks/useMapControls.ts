// COMPLETE & ENHANCED: src/hooks/useMapControls.ts
// Preserve + Add: Real-time updates, Contributions, Verification, Status tracking

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Office {
  id: number;
  latitude: number | null;
  longitude: number | null;
  county?: string;
  constituency_name?: string | null;
  office_location?: string;
  [key: string]: any;
}

interface ContributionData {
  officeId: number;
  type: 'location' | 'contact' | 'status' | 'other';
  description: string;
  photos?: string[];
}

interface ConfirmationData {
  officeId: number;
  userLatitude: number;
  userLongitude: number;
  userAccuracyMeters: number;
}

interface StatusReportData {
  officeId: number;
  status: 'operational' | 'closed' | 'relocated' | 'under_renovation';
  reason: string;
}

interface ContactUpdateData {
  officeId: number;
  phone?: string;
  email?: string;
  hours?: string;
  notes?: string;
}

export const useMapControls = (initialCenter: [number, number] = [-1.286389, 36.817223]) => {
  const queryClient = useQueryClient();
  
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [mapZoom, setMapZoom] = useState(10);
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [isListPanelOpen, setIsListPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const mapRef = useRef<any>(null);

  const flyToOffice = useCallback((office: Office | null) => {
    if (office?.latitude && office?.longitude && mapRef.current) {
      const latLng: [number, number] = [office.latitude, office.longitude];
      setMapCenter(latLng);
      setMapZoom(15);
      setSelectedOffice(office);
      
      if (mapRef.current) {
        mapRef.current.flyTo(latLng, 15, {
          duration: 1.5
        });
      }
    }
  }, []);

  const flyToLocation = useCallback((lat: number, lng: number, zoom = 15) => {
    if (mapRef.current) {
      const latLng: [number, number] = [lat, lng];
      setMapCenter(latLng);
      setMapZoom(zoom);
      
      mapRef.current.flyTo(latLng, zoom, {
        duration: 1.5
      });
    }
  }, []);

  const resetMap = useCallback(() => {
    setSelectedOffice(null);
    setSearchQuery('');
    if (mapRef.current) {
      mapRef.current.flyTo(initialCenter, 10, {
        duration: 1
      });
    }
  }, [initialCenter]);

  const openListPanel = useCallback(() => {
    setIsListPanelOpen(true);
  }, []);

  const closeListPanel = useCallback(() => {
    setIsListPanelOpen(false);
  }, []);

  const toggleListPanel = useCallback(() => {
    setIsListPanelOpen(prev => !prev);
  }, []);

  const contributions = {
    submit: useMutation({
      mutationFn: async (data: ContributionData) => {
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
        return contribution;
      },
      onSuccess: () => {
        toast.success('Contribution submitted successfully');
        queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
      },
      onError: (error: any) => {
        toast.error(`Failed to submit contribution: ${error.message}`);
      }
    })
  };

  const verification = {
    confirm: useMutation({
      mutationFn: async (data: ConfirmationData) => {
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
        return confirmation;
      },
      onSuccess: () => {
        toast.success('Location confirmed successfully');
        queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
      },
      onError: (error: any) => {
        toast.error(`Failed to confirm location: ${error.message}`);
      }
    })
  };

  const statusReport = {
    submit: useMutation({
      mutationFn: async (data: StatusReportData) => {
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
        return statusReport;
      },
      onSuccess: () => {
        toast.success('Status report submitted successfully');
        queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
      },
      onError: (error: any) => {
        toast.error(`Failed to report status: ${error.message}`);
      }
    })
  };

  const contactUpdate = {
    submit: useMutation({
      mutationFn: async (data: ContactUpdateData) => {
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
        return contactUpdate;
      },
      onSuccess: () => {
        toast.success('Contact update suggestion submitted');
        queryClient.invalidateQueries({ queryKey: ['iebc-offices'] });
      },
      onError: (error: any) => {
        toast.error(`Failed to suggest contact update: ${error.message}`);
      }
    })
  };

  const actions = {
    flyToOffice,
    flyToLocation,
    resetMap,
    openListPanel,
    closeListPanel,
    toggleListPanel,
    setMapCenter,
    setMapZoom,
    setSelectedOffice,
    setSearchQuery
  };

  return {
    mapCenter,
    mapZoom,
    selectedOffice,
    isListPanelOpen,
    searchQuery,
    mapRef,
    actions,
    contributions,
    verification,
    statusReport,
    contactUpdate
  };
};
