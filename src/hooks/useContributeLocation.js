import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useContributeLocation = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submitContribution = useCallback(async (contributionData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Starting contribution submission:', contributionData);

      // Validate required data
      if (!contributionData.latitude || !contributionData.longitude) {
        throw new Error('Latitude and longitude are required');
      }

      let imageUploadResult = null;

      // Upload image if provided
      if (contributionData.imageFile) {
        console.log('Uploading image...');
        const fileExt = 'webp';
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `map-data/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('map-data')
          .upload(filePath, contributionData.imageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Image upload error:', uploadError);
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('map-data')
          .getPublicUrl(filePath);

        imageUploadResult = {
          path: uploadData.path,
          publicUrl
        };
        console.log('Image uploaded successfully:', imageUploadResult);
      }

      // Prepare device metadata (without PII)
      const deviceMeta = {
        accuracy: contributionData.accuracy,
        altitude: contributionData.altitude,
        altitudeAccuracy: contributionData.altitudeAccuracy,
        heading: contributionData.heading,
        speed: contributionData.speed,
        timestamp: contributionData.timestamp,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language
      };

      // Insert contribution record
      console.log('Inserting contribution into database...');
      const { data, error: insertError } = await supabase
        .from('iebc_office_contributions')
        .insert([{
          original_office_id: contributionData.officeId || null,
          submitted_county: contributionData.county || null,
          submitted_constituency_code: contributionData.constituencyCode || null,
          submitted_constituency: contributionData.constituency || null,
          submitted_office_location: contributionData.officeLocation || 'User Contributed Location',
          submitted_landmark: contributionData.landmark || null,
          submitted_latitude: contributionData.latitude,
          submitted_longitude: contributionData.longitude,
          submitted_accuracy_meters: contributionData.accuracy || null,
          device_metadata: deviceMeta,
          nearby_landmarks: contributionData.nearbyLandmarks || null,
          image_path: imageUploadResult?.path,
          image_public_url: imageUploadResult?.publicUrl,
          status: 'pending'
        }])
        .select()
        .single();

      if (insertError) {
        console.error('Database insert error:', insertError);
        throw new Error(`Failed to save contribution: ${insertError.message}`);
      }

      console.log('Contribution submitted successfully:', data);
      return data;

    } catch (err) {
      console.error('Contribution submission error:', err);
      setError(err.message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return {
    submitContribution,
    isSubmitting,
    error
  };
};
