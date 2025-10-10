export const mapConfig = {
  // Default center (Nairobi)
  defaultCenter: [-1.286389, 36.817223],
  defaultZoom: 10,
  
  // Map bounds for Kenya
  kenyaBounds: [
    [ -4.9, 33.5 ], // SW
    [ 5.0, 42.0 ]   // NE
  ],
  
  // Tile layer configurations
  tileLayers: {
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>'
    }
  },
  
  // Marker configurations
  markers: {
    user: {
      color: '#007AFF',
      radius: 8
    },
    office: {
      color: '#007AFF',
      radius: 6
    },
    nearest: {
      color: '#34C759',
      radius: 8
    },
    selected: {
      color: '#FF3B30',
      radius: 8
    }
  }
};

export const isWithinKenya = (lat, lng) => {
  const [[south, west], [north, east]] = mapConfig.kenyaBounds;
  return lat >= south && lat <= north && lng >= west && lng <= east;
};
