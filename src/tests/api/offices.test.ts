import { describe, it, expect, beforeEach } from 'vitest';
import { testSupabase, testUser } from '../setup';

describe('Offices API', () => {
  beforeEach(async () => {
    // Clean up test data
    await testSupabase.from('iebc_offices').delete().neq('id', 'test-office-1');
    await testSupabase.from('iebc_offices').delete().neq('id', 'test-office-2');
  });

  describe('GET /api/v1/offices', () => {
    it('should return list of offices', async () => {
      const response = await fetch('/api/v1/offices');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by county', async () => {
      const response = await fetch('/api/v1/offices?county=Nairobi');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      data.data.forEach((office: any) => {
        expect(office.county).toContain('Nairobi');
      });
    });

    it('should paginate results', async () => {
      const response = await fetch('/api/v1/offices?limit=5&offset=0');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(0);
    });
  });

  describe('GET /api/v1/offices/search', () => {
    it('should search offices by query', async () => {
      const response = await fetch('/api/v1/offices/search?q=Westlands');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should return 400 for missing query', async () => {
      const response = await fetch('/api/v1/offices/search');
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('required');
    });
  });

  describe('GET /api/v1/offices/nearby', () => {
    it('should find nearby offices', async () => {
      const response = await fetch('/api/v1/offices/nearby?lat=-1.2654&lng=36.7984&radius=10');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      data.data.forEach((office: any) => {
        expect(office.distanceKm).toBeDefined();
        expect(typeof office.distanceKm).toBe('number');
      });
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await fetch('/api/v1/offices/nearby?lat=invalid&lng=invalid');
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/v1/offices/[id]', () => {
    it('should return office details', async () => {
      const response = await fetch('/api/v1/offices/test-office-1');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('test-office-1');
    });

    it('should return 404 for non-existent office', async () => {
      const response = await fetch('/api/v1/offices/non-existent');
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not found');
    });
  });

  describe('GET /api/v1/offices/with-relations', () => {
    it('should return office with all relations', async () => {
      const response = await fetch('/api/v1/offices/with-relations?id=test-office-1');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.confirmations).toBeDefined();
      expect(data.data.operational_status_history).toBeDefined();
      expect(data.data.contributions).toBeDefined();
      expect(data.data.metrics).toBeDefined();
    });
  });
});
