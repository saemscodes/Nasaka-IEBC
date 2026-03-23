import { describe, it, expect, beforeEach } from 'vitest';
import { testSupabase, testUser } from '../setup';

describe('Verification API', () => {
  beforeEach(async () => {
    // Clean up test data
    await testSupabase.from('confirmations').delete().eq('user_id', testUser.id);
  });

  describe('POST /api/v1/verification/confirm', () => {
    it('should submit office confirmation', async () => {
      const confirmationData = {
        officeId: 'test-office-1',
        userId: testUser.id,
        isAccurate: true,
        notes: 'Verified in person'
      };

      const response = await fetch('/api/v1/verification/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(confirmationData)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.office_id).toBe(confirmationData.officeId);
      expect(data.data.user_id).toBe(confirmationData.userId);
      expect(data.data.is_accurate).toBe(confirmationData.isAccurate);
    });

    it('should prevent duplicate confirmations', async () => {
      const confirmationData = {
        officeId: 'test-office-1',
        userId: testUser.id,
        isAccurate: true
      };

      // First confirmation
      await fetch('/api/v1/verification/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmationData)
      });

      // Second confirmation should fail
      const response = await fetch('/api/v1/verification/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmationData)
      });

      const data = await response.json();
      
      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already confirmed');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await fetch('/api/v1/verification/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  describe('GET /api/v1/verification/confirm', () => {
    it('should get confirmations for office', async () => {
      // First, add a confirmation
      await testSupabase.from('confirmations').insert({
        office_id: 'test-office-1',
        user_id: testUser.id,
        is_accurate: true,
        created_at: new Date().toISOString()
      });

      const response = await fetch('/api/v1/verification/confirm?officeId=test-office-1');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should get confirmations for user', async () => {
      // First, add a confirmation
      await testSupabase.from('confirmations').insert({
        office_id: 'test-office-1',
        user_id: testUser.id,
        is_accurate: true,
        created_at: new Date().toISOString()
      });

      const response = await fetch(`/api/v1/verification/confirm?userId=${testUser.id}`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });
  });

  describe('GET /api/v1/verification/statistics', () => {
    it('should return verification statistics', async () => {
      const response = await fetch('/api/v1/verification/statistics');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.type).toBe('overview');
    });

    it('should return statistics for specific office', async () => {
      const response = await fetch('/api/v1/verification/statistics?officeId=test-office-1');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.type).toBe('office');
    });
  });
});
