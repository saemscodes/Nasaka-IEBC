import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIEBCOffices } from '../../hooks/useIEBCOffices';
import { testSupabase, testUser } from '../setup';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => testSupabase)
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useIEBCOffices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch offices successfully', async () => {
    const mockOffices = [
      {
        id: 'test-office-1',
        county: 'Nairobi',
        constituency_name: 'Westlands',
        office_location: 'Westlands Office'
      }
    ];

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      select: vi.fn(() => ({
        data: mockOffices,
        error: null
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.offices).toEqual(mockOffices);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should handle fetch error', async () => {
    const mockError = new Error('Database error');

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      select: vi.fn(() => ({
        data: null,
        error: mockError
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.offices).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(mockError.message);
  });

  it('should search offices', async () => {
    const mockSearchResults = [
      {
        id: 'test-office-1',
        county: 'Nairobi',
        constituency_name: 'Westlands',
        office_location: 'Westlands Office'
      }
    ];

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      select: vi.fn(() => ({
        data: mockSearchResults,
        error: null
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      await result.current.searchOffices('Westlands');
    });

    expect(result.current.searchResults).toEqual(mockSearchResults);
    expect(result.current.isSearching).toBe(false);
  });

  it('should confirm office accuracy', async () => {
    const mockConfirmation = {
      id: 1,
      office_id: 1,
      user_id: testUser.id,
      is_accurate: true
    };

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      insert: vi.fn(() => ({
        data: mockConfirmation,
        error: null
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      const response = await result.current.confirmAccuracy({
        officeId: 1,
        userLatitude: -1.28,
        userLongitude: 36.82,
        userAccuracyMeters: 10
      });
      expect(response).toEqual(mockConfirmation);
    });
  });

  it('should submit contribution', async () => {
    const mockContribution = {
      id: 1,
      office_id: 1,
      type: 'location',
      description: 'Office moved'
    };

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      insert: vi.fn(() => ({
        data: mockContribution,
        error: null
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      const response = await result.current.submitContribution({
        officeId: 1,
        type: 'location',
        description: 'Office moved'
      });
      expect(response).toEqual(mockContribution);
    });
  });

  it('should report status change', async () => {
    const mockStatusReport = {
      id: 1,
      office_id: 1,
      status: 'closed'
    };

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      insert: vi.fn(() => ({
        data: mockStatusReport,
        error: null
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      const response = await result.current.reportStatusChange({
        officeId: 1,
        status: 'closed',
        reason: 'Temporarily closed'
      });
      expect(response).toEqual(mockStatusReport);
    });
  });

  it('should suggest contact update', async () => {
    const mockUpdate = {
      id: 1,
      office_id: 1,
      phone: '+254 123 456 789'
    };

    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      insert: vi.fn(() => ({
        data: mockUpdate,
        error: null
      }))
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      const response = await result.current.suggestContactUpdate({
        officeId: 1,
        phone: '+254 123 456 789'
      });
      expect(response).toEqual(mockUpdate);
    });
  });

  it('should fetch nearby offices', async () => {
    const mockNearbyOffices = [
      {
        id: 'test-office-2',
        county: 'Nairobi',
        constituency_name: 'Kasarani',
        distanceKm: 5.2
      }
    ];

    vi.spyOn(testSupabase, 'rpc').mockImplementation(() => ({
      data: mockNearbyOffices,
      error: null
    } as any));

    const { result } = renderHook(() => useIEBCOffices(), {
      wrapper: createWrapper()
    });

    await act(async () => {
      const offices = await result.current.getNearbyOffices(-1.2654, 36.7984, 10);
      expect(offices).toEqual(mockNearbyOffices);
    });
  });
});
