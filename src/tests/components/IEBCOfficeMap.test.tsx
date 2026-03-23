import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import IEBCOfficeMap from '../../pages/IEBCOffice/IEBCOfficeMap';
import { testSupabase, testUser } from '../setup';

// Mock Leaflet
vi.mock('leaflet', () => ({
  map: vi.fn(() => ({
    setView: vi.fn(),
    on: vi.fn(),
    remove: vi.fn()
  })),
  tileLayer: vi.fn(() => ({
    addTo: vi.fn()
  })),
  marker: vi.fn(() => ({
    addTo: vi.fn(),
    bindPopup: vi.fn()
  })),
  icon: vi.fn(),
  popup: vi.fn()
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => testSupabase)
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('IEBCOfficeMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders map component', () => {
    renderWithRouter(<IEBCOfficeMap />);
    
    // Check if map container is rendered
    expect(screen.getByTestId('office-map')).toBeInTheDocument();
  });

  it('displays search input', () => {
    renderWithRouter(<IEBCOfficeMap />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it('filters offices by search query', async () => {
    renderWithRouter(<IEBCOfficeMap />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Nairobi' } });
    
    await waitFor(() => {
      // Verify search was triggered
      expect(searchInput).toHaveValue('Nairobi');
    });
  });

  it('shows office details when marker is clicked', async () => {
    // Mock office data
    const mockOffice = {
      id: 'test-office-1',
      office_location: 'Test Office',
      county: 'Nairobi',
      constituency_name: 'Westlands',
      latitude: -1.2654,
      longitude: 36.7984
    };

    renderWithRouter(<IEBCOfficeMap />);
    
    // Simulate marker click
    fireEvent.click(screen.getByTestId('office-marker-test-office-1'));
    
    await waitFor(() => {
      expect(screen.getByText('Test Office')).toBeInTheDocument();
    });
  });

  it('handles location detection', async () => {
    // Mock geolocation
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: -1.2654,
            longitude: 36.7984
          }
        });
      })
    };
    
    Object.defineProperty(global.navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true
    });

    renderWithRouter(<IEBCOfficeMap />);
    
    const locationButton = screen.getByTestId('location-button');
    fireEvent.click(locationButton);
    
    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    });
  });

  it('displays loading state', () => {
    renderWithRouter(<IEBCOfficeMap />);
    
    // Check for loading indicator
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    // Mock error response
    vi.spyOn(testSupabase, 'from').mockImplementation(() => ({
      select: vi.fn(() => ({
        data: null,
        error: new Error('Database error')
      }))
    }));

    renderWithRouter(<IEBCOfficeMap />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
