// src/utils/rideLinks.js
// Complete ride-hailing and navigation deep link utilities for Kenya market

const isIOS = () => /iP(hone|od|ad)/i.test(navigator.userAgent);
const isAndroid = () => /Android/i.test(navigator.userAgent);

const fmt = (lat, lng) => `${Number(lat).toFixed(6)},${Number(lng).toFixed(6)}`;
const enc = (s) => encodeURIComponent(s || '');

export function buildUrlsFor(provider, options = {}) {
  const { pickup, destination, productType } = options;
  
  const p = pickup ? fmt(
    pickup.lat ?? pickup.latitude, 
    pickup.lng ?? pickup.longitude
  ) : null;
  
  const d = destination ? fmt(
    destination.lat ?? destination.latitude, 
    destination.lng ?? destination.longitude
  ) : null;

  switch ((provider || '').toLowerCase()) {
    case 'uber': {
      const pickupParams = p ? [
        `pickup[latitude]=${enc(p.split(',')[0])}`,
        `pickup[longitude]=${enc(p.split(',')[1])}`,
        `pickup[nickname]=${enc('Your Location')}`
      ] : [];

      const dropoffParams = d ? [
        `dropoff[latitude]=${enc(d.split(',')[0])}`,
        `dropoff[longitude]=${enc(d.split(',')[1])}`,
        `dropoff[nickname]=${enc('IEBC Office')}`
      ] : [];

      const productParam = productType ? `&product_id=${enc(productType)}` : '';

      const webParams = [...pickupParams, ...dropoffParams].join('&');
      const web = `https://m.uber.com/ul/?action=setPickup${webParams ? `&${webParams}` : ''}${productParam}`;
      
      const appParams = [...pickupParams, ...dropoffParams].join('&');
      const app = `uber://?action=setPickup${appParams ? `&${appParams}` : ''}${productParam}`;

      return { app, web };
    }

    case 'bolt': {
      const pickupStr = p || '';
      const destStr = d || '';
      
      const web = d 
        ? `https://bolt.eu/en-ke/ride/?pickup=${enc(pickupStr)}&destination=${enc(destStr)}`
        : 'https://bolt.eu/en-ke/';
      
      const app = 'bolt://';
      
      return { app, web };
    }

    case 'google':
    case 'googlemaps': {
      const web = `https://www.google.com/maps/dir/?api=1${p ? `&origin=${enc(p)}` : ''}${d ? `&destination=${enc(d)}` : ''}&travelmode=driving`;
      
      const app = isIOS() 
        ? `comgooglemaps://?saddr=${enc(p || '')}&daddr=${enc(d || '')}&directionsmode=driving` 
        : null;

      return { app, web };
    }

    case 'apple':
    case 'applemaps': {
      const web = `https://maps.apple.com/?${p ? `saddr=${enc(p)}&` : ''}${d ? `daddr=${enc(d)}&` : ''}dirflg=d`;
      
      return { app: null, web };
    }

    default: {
      const web = d
        ? `https://www.google.com/maps/search/?api=1&query=${enc(d)}`
        : 'https://www.google.com/maps';
      
      return { app: null, web };
    }
  }
}

export const UBER_PRODUCTS = {
  CHAP_CHAP: 'a5a0d0d4-8c0f-4c3c-9e89-0b2d8a2c7f2a',
  UBER_X: 'a1111c8c-c720-46c3-8534-2fcdd730040d',
  COMFORT: 'UberComfort',
  XL: '821415d8-3bd5-4e27-9604-194e4359a449'
};

export function openWithAppFallback(appUrl, webUrl, options = {}) {
  const { fallbackDelay = 800, target = '_blank' } = options;

  if (!appUrl) {
    window.open(webUrl, target);
    return;
  }

  let fallbackTimer = null;
  let visibilityHandler = null;
  let didHide = false;

  const clearHandlers = () => {
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (visibilityHandler) {
      document.removeEventListener('visibilitychange', visibilityHandler);
    }
  };

  visibilityHandler = () => {
    if (document.hidden) {
      didHide = true;
      clearHandlers();
    }
  };
  
  document.addEventListener('visibilitychange', visibilityHandler);

  try {
    window.location = appUrl;
  } catch (err) {
    console.warn('App URL open failed:', err);
  }

  fallbackTimer = setTimeout(() => {
    if (!didHide) {
      try {
        window.open(webUrl, target);
      } catch (e) {
        window.location = webUrl;
      }
    }
    clearHandlers();
  }, fallbackDelay);
}

export function getProviderColors(provider, isDark = false) {
  const colors = {
    uber: {
      light: { 
        bg: 'bg-white', 
        text: 'text-black', 
        hover: 'hover:bg-gray-900',
        border: 'border-black',
        shadow: 'shadow-lg hover:shadow-xl'
      },
      dark: { 
        bg: 'bg-black', 
        text: 'text-white', 
        hover: 'hover:bg-gray-800',
        border: 'border-gray-700',
        shadow: 'shadow-lg hover:shadow-xl'
      }
    },
    bolt: {
      light: { 
        bg: 'bg-[#34D186]', 
        text: 'text-black', 
        hover: 'hover:bg-[#2BBD75]',
        border: 'border-[#34D186]',
        shadow: 'shadow-lg hover:shadow-xl'
      },
      dark: { 
        bg: 'bg-[#34D186]', 
        text: 'text-black', 
        hover: 'hover:bg-[#2BBD75]',
        border: 'border-[#34D186]',
        shadow: 'shadow-lg hover:shadow-xl'
      }
    },
    google: {
      light: { 
        bg: 'bg-white', 
        text: 'text-gray-900', 
        hover: 'hover:bg-gray-50',
        border: 'border-gray-300',
        shadow: 'shadow-lg hover:shadow-xl'
      },
      dark: { 
        bg: 'bg-[#1F1F1F]', 
        text: 'text-white', 
        hover: 'hover:bg-[#2A2A2A]',
        border: 'border-gray-700',
        shadow: 'shadow-lg hover:shadow-xl'
      }
    },
    apple: {
      light: { 
        bg: 'bg-white', 
        text: 'text-gray-900', 
        hover: 'hover:bg-gray-50',
        border: 'border-gray-300',
        shadow: 'shadow-lg hover:shadow-xl'
      },
      dark: { 
        bg: 'bg-[#1C1C1E]', 
        text: 'text-white', 
        hover: 'hover:bg-[#2C2C2E]',
        border: 'border-gray-700',
        shadow: 'shadow-lg hover:shadow-xl'
      }
    }
  };

  const mode = isDark ? 'dark' : 'light';
  return colors[provider]?.[mode] || colors.google[mode];
}

export function trackProviderOpen(provider, options = {}) {
  const { productType, source = 'map' } = options;
  
  console.log('[Analytics] Provider opened:', { provider, productType, source, timestamp: new Date().toISOString() });

  if (window.gtag) {
    window.gtag('event', 'ride_request', { provider, product_type: productType, source });
  }
}
