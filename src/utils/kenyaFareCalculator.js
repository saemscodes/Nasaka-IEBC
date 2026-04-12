// src/utils/kenyaFareCalculator.js
// REAL 2024-2025 pricing data for Kenya ride-hailing services
// Based on verified August 2024 pricing updates

import i18next from 'i18next';

/**
 * Current Kenya pricing structure (as of August 2024)
 * Sources: Semafor Africa, Business Daily Kenya, TechCabal
 */

// UBER KENYA PRICING (August 2024 Update)
export const UBER_NAIROBI_RATES = {
  chap_chap: {
    baseFare: 70,
    perKm: 22,
    perMinute: 3,
    minimumFare: 150,
    bookingFee: 0,
    displayName: 'Chap Chap',
    description: 'Motorcycle taxis',
    icon: 'motorcycle',
    provider: 'uber'
  },
  uberx: {
    baseFare: 85,
    perKm: 27,
    perMinute: 4,
    minimumFare: 220,
    bookingFee: 0,
    displayName: 'UberX',
    description: 'Everyday affordable rides',
    icon: 'car',
    provider: 'uber'
  },
  comfort: {
    baseFare: 100,
    perKm: 32,
    perMinute: 4.5,
    minimumFare: 250,
    bookingFee: 0,
    displayName: 'Comfort',
    description: 'Newer cars with extra legroom',
    icon: 'sparkles',
    provider: 'uber'
  },
  uberxl: {
    baseFare: 120,
    perKm: 38,
    perMinute: 5,
    minimumFare: 300,
    bookingFee: 0,
    displayName: 'UberXL',
    description: 'Larger vehicles for groups',
    icon: 'users',
    provider: 'uber'
  }
};

export const UBER_MOMBASA_RATES = {
  uberx: {
    baseFare: 70,
    perKm: 27,
    perMinute: 3,
    minimumFare: 200,
    bookingFee: 0,
    displayName: 'UberX',
    description: 'Affordable, everyday rides',
    icon: 'car',
    provider: 'uber'
  }
};

// BOLT KENYA PRICING (October 2023 - Latest available)
export const BOLT_NAIROBI_RATES = {
  boda: {
    baseFare: 50,
    perKm: 20,
    perMinute: 3,
    minimumFare: 120,
    bookingFee: 0,
    displayName: 'Bolt Boda',
    description: 'Motorcycle rides',
    icon: 'motorcycle',
    provider: 'bolt'
  },
  economy: {
    baseFare: 70,
    perKm: 27.37,
    perMinute: 4,
    minimumFare: 200,
    bookingFee: 0,
    displayName: 'Bolt Economy',
    description: 'Budget-friendly rides',
    icon: 'car-front',
    provider: 'bolt'
  },
  base: {
    baseFare: 85,
    perKm: 30,
    perMinute: 4,
    minimumFare: 220,
    bookingFee: 0,
    displayName: 'Bolt',
    description: 'Standard rides',
    icon: 'car',
    provider: 'bolt'
  },
  xl: {
    baseFare: 100,
    perKm: 35,
    perMinute: 5,
    minimumFare: 250,
    bookingFee: 0,
    displayName: 'Bolt XL',
    description: 'Larger vehicles for groups',
    icon: 'users',
    provider: 'bolt'
  }
};

/**
 * Traffic multipliers based on time of day and typical Nairobi traffic patterns
 */
export const TRAFFIC_MULTIPLIERS = {
  rush_morning: {
    timeRange: '07:00-09:30',
    multiplier: 1.3,
    description: 'Morning rush hour',
    additionalMinutes: 10,
    color: 'text-orange-500',
    icon: 'sunrise'
  },
  rush_evening: {
    timeRange: '17:00-20:00',
    multiplier: 1.4,
    description: 'Evening rush hour',
    additionalMinutes: 15,
    color: 'text-red-500',
    icon: 'sunset'
  },
  midday: {
    timeRange: '09:30-17:00',
    multiplier: 1.1,
    description: 'Moderate traffic',
    additionalMinutes: 5,
    color: 'text-yellow-500',
    icon: 'sun'
  },
  night: {
    timeRange: '20:00-07:00',
    multiplier: 1.0,
    description: 'Light traffic',
    additionalMinutes: 0,
    color: 'text-blue-400',
    icon: 'moon'
  },
  weekend: {
    multiplier: 0.95,
    description: 'Weekend - lighter traffic',
    additionalMinutes: 0,
    color: 'text-green-500',
    icon: 'party-popper'
  }
};

/**
 * Get current traffic condition based on time and weather
 */
export function getCurrentTrafficCondition(weatherData = null) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour + minute / 60;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  let condition = TRAFFIC_MULTIPLIERS.night;

  if (isWeekend) {
    condition = { ...TRAFFIC_MULTIPLIERS.weekend };
  } else if (currentTime >= 7 && currentTime < 9.5) {
    condition = { ...TRAFFIC_MULTIPLIERS.rush_morning };
  } else if (currentTime >= 17 && currentTime < 20) {
    condition = { ...TRAFFIC_MULTIPLIERS.rush_evening };
  } else if (currentTime >= 9.5 && currentTime < 17) {
    condition = { ...TRAFFIC_MULTIPLIERS.midday };
  }

  // Apply weather impact (Rain sensitivity as requested)
  if (weatherData) {
    const isRaining = weatherData.isRaining || (weatherData.weatherDesc && weatherData.weatherDesc.toLowerCase().includes('rain'));
    if (isRaining) {
      condition.multiplier *= 1.25; // Increase multiplier by 25% for rain
      condition.additionalMinutes += 10; // Add 10 more minutes
      condition.description += ' + Heavy Rain';
      condition.icon = 'cloud-rain';
      condition.color = 'text-blue-600';
    }
  }

  return condition;
}

/**
 * Get traffic info for display
 */
export function getTrafficInfo(weatherData = null) {
  const traffic = getCurrentTrafficCondition(weatherData);
  return {
    ...traffic,
    displayText: `${traffic.description}`
  };
}

/**
 * Calculate fare for a ride
 */
export function calculateFare(distanceKm, estimatedMinutes, rateCard, options = {}) {
  const { includeTraffic = true, trafficCondition = null } = options;

  const traffic = trafficCondition || (includeTraffic ? getCurrentTrafficCondition() : null);
  const adjustedMinutes = traffic ? estimatedMinutes + traffic.additionalMinutes : estimatedMinutes;

  const baseFare = rateCard.baseFare;
  const distanceFare = distanceKm * rateCard.perKm;
  const timeFare = adjustedMinutes * rateCard.perMinute;
  const bookingFee = rateCard.bookingFee || 0;

  let subtotal = baseFare + distanceFare + timeFare + bookingFee;

  if (traffic && traffic.multiplier) {
    subtotal = subtotal * traffic.multiplier;
  }

  const total = Math.max(subtotal, rateCard.minimumFare);

  return {
    baseFare,
    distanceFare: Math.round(distanceFare),
    timeFare: Math.round(timeFare),
    bookingFee,
    trafficSurcharge: traffic ? Math.round(subtotal - (baseFare + distanceFare + timeFare + bookingFee)) : 0,
    subtotal: Math.round(subtotal),
    total: Math.round(total),
    minimumFareApplied: total === rateCard.minimumFare,
    trafficCondition: traffic ? traffic.description : 'Normal',
    estimatedMinutes: Math.round(adjustedMinutes),
    originalMinutes: estimatedMinutes,
    currency: 'KES',
    displayName: rateCard.displayName,
    description: rateCard.description,
    icon: rateCard.icon,
    provider: rateCard.provider
  };
}

/**
 * Calculate fares for all available services
 */
export function calculateAllFares(distanceKm, estimatedMinutes, city = 'nairobi') {
  const traffic = getCurrentTrafficCondition();
  const rates = city === 'mombasa' ? UBER_MOMBASA_RATES : UBER_NAIROBI_RATES;

  const results = {
    uber: {},
    bolt: {},
    traffic,
    timestamp: new Date().toISOString()
  };

  // Calculate Uber fares
  Object.entries(rates).forEach(([key, rateCard]) => {
    results.uber[key] = calculateFare(distanceKm, estimatedMinutes, rateCard, { trafficCondition: traffic });
  });

  // Calculate Bolt fares (Nairobi only for now)
  if (city === 'nairobi') {
    Object.entries(BOLT_NAIROBI_RATES).forEach(([key, rateCard]) => {
      results.bolt[key] = calculateFare(distanceKm, estimatedMinutes, rateCard, { trafficCondition: traffic });
    });
  }

  return results;
}

/**
 * Get cheapest option across all providers
 */
export function getCheapestOption(fares) {
  let cheapest = null;
  let cheapestPrice = Infinity;

  ['uber', 'bolt'].forEach(provider => {
    if (fares[provider]) {
      Object.entries(fares[provider]).forEach(([key, fare]) => {
        if (fare.total < cheapestPrice) {
          cheapestPrice = fare.total;
          cheapest = {
            provider,
            serviceType: key,
            ...fare
          };
        }
      });
    }
  });

  return cheapest;
}

/**
 * Format fare for display
 */
export function formatFare(amount) {
  return `KES ${Math.round(amount).toLocaleString()}`;
}

/**
 * Get fare range string
 */
export function getFareRange(fares) {
  const allFares = [];

  ['uber', 'bolt'].forEach(provider => {
    if (fares[provider]) {
      Object.values(fares[provider]).forEach(fare => {
        allFares.push(fare.total);
      });
    }
  });

  if (allFares.length === 0) return 'N/A';

  const min = Math.min(...allFares);
  const max = Math.max(...allFares);

  if (min === max) return formatFare(min);
  return `${formatFare(min)} - ${formatFare(max)}`;
}

/**
 * Estimate travel time based on distance (Nairobi context)
 */
export function estimateTravelTime(distanceKm) {
  const traffic = getCurrentTrafficCondition();

  const speeds = {
    rush_morning: 15,
    rush_evening: 12,
    midday: 25,
    night: 35,
    weekend: 30
  };

  const speed = speeds[traffic.description] || 25;
  const baseMinutes = (distanceKm / speed) * 60;

  return Math.round(baseMinutes);
}

/**
 * DISCLAIMER TEXT - Important for users
 */
export const FARE_DISCLAIMER = {
  get text() {
    return i18next.t('bottomSheet.fareDisclaimer', "Estimated fares based on August 2024 rates. Actual fare may vary due to real-time demand, route taken, and traffic conditions. Final price shown in the app before confirming your ride.");
  }
};
