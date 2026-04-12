import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactElement } from 'react';
import { vi } from 'vitest';

// Test utility functions
export const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0
    },
    mutations: {
      retry: false
    }
  }
});

// Custom render function with providers
export const renderWithProviders = (
  ui: ReactElement,
  options: RenderOptions = {}
) => {
  const testQueryClient = createTestQueryClient();

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

// Mock data generators
export const createMockOffice = (overrides = {}) => ({
  id: 'test-office-1',
  county: 'Nairobi',
  constituency_name: 'Westlands',
  office_location: 'Westlands Constituency Office',
  latitude: -1.2654,
  longitude: 36.7984,
  verified: true,
  operational_status: 'operational',
  phone: '+254 123 456 789',
  email: 'westlands@iebc.or.ke',
  operating_hours: '8:00 AM - 5:00 PM',
  landmark: 'Near Westlands Mall',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

export const createMockContribution = (overrides = {}) => ({
  id: 'test-contribution-1',
  office_id: 'test-office-1',
  user_id: 'test-user-1',
  contribution_type: 'location_update',
  description: 'Office has moved',
  status: 'pending',
  votes_count: 0,
  evidence_photos: [],
  created_at: new Date().toISOString(),
  ...overrides
});

export const createMockConfirmation = (overrides = {}) => ({
  id: 'test-confirmation-1',
  office_id: 'test-office-1',
  user_id: 'test-user-1',
  is_accurate: true,
  notes: 'Verified in person',
  confirmation_weight: 1.0,
  created_at: new Date().toISOString(),
  ...overrides
});

export const createMockStatusReport = (overrides = {}) => ({
  id: 'test-status-1',
  office_id: 'test-office-1',
  user_id: 'test-user-1',
  status: 'operational',
  notes: 'Office is open',
  evidence_photos: [],
  verified_by: 'pending',
  created_at: new Date().toISOString(),
  ...overrides
});

// API response helpers
export const createMockApiResponse = (data: any, success = true) => ({
  success,
  data,
  error: success ? null : 'Test error'
});

// Event helpers
export const createMockEvent = (overrides: any = {}) => ({
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
  target: {
    value: '',
    checked: false,
    ...overrides.target
  },
  ...overrides
});

// Geolocation mock
export const createMockGeolocation = (position = { lat: -1.2654, lng: 36.7984 }) => ({
  getCurrentPosition: vi.fn((success, error) => {
    if (error) {
      error(new Error('Geolocation denied'));
    } else {
      success({
        coords: {
          latitude: position.lat,
          longitude: position.lng,
          accuracy: 10
        }
      });
    }
  })
});

// LocalStorage mock
export const createMockLocalStorage = () => {
  const store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    })
  };
};

// IntersectionObserver mock
export const createMockIntersectionObserver = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
});

// ResizeObserver mock
export const createMockResizeObserver = () => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
});

// Fetch mock helper
export const mockFetchResponse = (data: any, status = 200, ok = true) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data))
  } as Response);
};

// Supabase mock helpers
export const createMockSupabaseClient = () => ({
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      data: [],
      error: null,
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      insert: vi.fn(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn(),
      rpc: vi.fn()
    })),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    rpc: vi.fn()
  })),
  auth: {
    getUser: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn()
  }
});
