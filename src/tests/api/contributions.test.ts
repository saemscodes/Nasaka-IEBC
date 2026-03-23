import { describe, it, expect, beforeEach } from 'vitest';
import { testSupabase, testUser } from '../setup';

describe('Contributions API', () => {
  beforeEach(async () => {
    // Clean up test data
    await testSupabase.from('contributions').delete().eq('user_id', testUser.id);
    await testSupabase.from('contribution_votes').delete().eq('user_id', testUser.id);
  });

  describe('POST /api/v1/contributions/submit', () => {
    it('should submit a contribution', async () => {
      const contributionData = {
        officeId: 'test-office-1',
        userId: testUser.id,
        contributionType: 'location_update',
        description: 'Office has moved to new location',
        locationData: {
          latitude: -1.2655,
          longitude: 36.7985,
          address: 'New address'
        },
        evidencePhotos: ['photo1.jpg']
      };

      const response = await fetch('/api/v1/contributions/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contributionData)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.office_id).toBe(contributionData.officeId);
      expect(data.data.user_id).toBe(contributionData.userId);
      expect(data.data.contribution_type).toBe(contributionData.contributionType);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await fetch('/api/v1/contributions/submit', {
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

  describe('POST /api/v1/contributions/vote', () => {
    it('should vote on contribution', async () => {
      // First create a contribution
      const { data: contribution } = await testSupabase
        .from('contributions')
        .insert({
          office_id: 'test-office-1',
          user_id: testUser.id,
          contribution_type: 'location_update',
          description: 'Test contribution',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      const voteData = {
        contributionId: contribution.id,
        userId: testUser.id,
        voteType: 'upvote'
      };

      const response = await fetch('/api/v1/contributions/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(voteData)
      });

      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.contribution_id).toBe(voteData.contributionId);
      expect(data.data.vote_type).toBe(voteData.voteType);
    });

    it('should update existing vote', async () => {
      // Create a contribution
      const { data: contribution } = await testSupabase
        .from('contributions')
        .insert({
          office_id: 'test-office-1',
          user_id: testUser.id,
          contribution_type: 'location_update',
          description: 'Test contribution',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      // First vote
      await fetch('/api/v1/contributions/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contributionId: contribution.id,
          userId: testUser.id,
          voteType: 'upvote'
        })
      });

      // Update vote
      const response = await fetch('/api/v1/contributions/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contributionId: contribution.id,
          userId: testUser.id,
          voteType: 'downvote'
        })
      });

      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.vote_type).toBe('downvote');
    });
  });

  describe('GET /api/v1/contributions/recent', () => {
    it('should get recent contributions', async () => {
      const response = await fetch('/api/v1/contributions/recent');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by office', async () => {
      const response = await fetch('/api/v1/contributions/recent?officeId=test-office-1');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/v1/contributions/pending', () => {
    it('should get pending contributions', async () => {
      const response = await fetch('/api/v1/contributions/pending');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.pagination).toBeDefined();
    });
  });
});
