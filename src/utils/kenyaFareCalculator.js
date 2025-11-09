// src/utils/kenyaFareCalculator.js
// REAL 2024-2025 pricing data for Kenya ride-hailing services
// Based on verified August 2024 pricing updates

/**
 * Current Kenya pricing structure (as of August 2024)
 * Sources: Semafor Africa, Business Daily Kenya, TechCabal
 */

// UBER KENYA PRICING (August 2024 Update)
export const UBER_NAIROBI_RATES = {
  UberX: {
    baseFare: 85,
    perKm: 27,
    perMinute: 4,
    minimumFare: 220,
    bookingFee: 0,
    displayName: 'UberX',
    description: 'Affordable, everyday rides',
    icon: '🚗',
    provider: 'uber'
  },
  UberChap: {
    baseFare: 70,
    perKm: 22,
    perMinute: 3,
    minimumFare: 150,
    bookingFee: 0,
    displayName: 'Chap Chap',
    description: 'Quick motorcycle rides',
    icon: '🏍️',
    provider: 'uber'
  },
  Comfort: {
    baseFare: 100,
    perKm: 32,
    perMinute: 4.5,
    minimumFare: 250,
    bookingFee: 0,
    displayName: 'Comfort',
    description: 'Newer cars with extra legroom',
    icon: '✨',
    provider: 'uber'
  },
  UberXL: {
    baseFare: 120,
    perKm: 38,
    perMinute: 5,
    minimumFare: 300,
    bookingFee: 0,
    displayName: 'UberXL',
    description: 'Affordable rides for groups up to 6',
    icon: '🚙',
    provider: 'uber'
  }
};

export const UBER_MOMBASA_RATES = {
  UberX: {
    baseFare: 70,
    perKm: 27,
    perMinute: 3,
    minimumFare: 200,
    bookingFee: 0,
    displayName: 'UberX',
    description: 'Affordable, everyday rides',
    icon: '🚗',
    provider: 'uber'
  }
};

// BOLT KENYA PRICING (October 2023 - Latest available)
export const BOLT_NAIROBI_RATES = {
  Economy: {
    baseFare: 70,
    perKm: 27.37,
    perMinute: 4,
    minimumFare: 200,
    bookingFee: 0,
    displayName: 'Bolt Economy',
    description: 'Budget-friendly rides',
    icon: '⚡',
    provider: 'bolt'
  },
  Base: {
    baseFare: 85,
    perKm: 30,
    perMinute: 4,
    minimumFare: 220,
    bookingFee: 0,
    displayName: 'Bolt',
    description: 'Standard rides',
    icon: '⚡',
    provider: 'bolt'
  },
  XL: {
    baseFare: 100,
    perKm: 35,
    perMinute: 5,
    minimumFare: 250,
    bookingFee: 0,
    displayName: 'Bolt XL',
    description: 'Larger vehicles for groups',
    icon: '⚡',
    provider: 'bolt'
  },
  Boda: {
    baseFare: 50,
    perKm: 20,
    perMinute: 3,
    minimumFare: 120,
    bookingFee: 0,
    displayName: 'Bolt Boda',
    description: 'Motorcycle rides',
    icon: '🏍️',
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
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200'
  },
  rush_evening: {
    timeRange: '17:00-20:00',
    multiplier: 1.4,
    description: 'Evening rush hour',
    additionalMinutes: 15,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200'
  },
  midday: {
    timeRange: '09:30-17:00',
    multiplier: 1.1,
    description: 'Moderate traffic',
    additionalMinutes: 5,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200'
  },
  night: {
    timeRange: '20:00-07:00',
    multiplier: 1.0,
    description: 'Light traffic',
    additionalMinutes: 0,
    color: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200'
  },
  weekend: {
    multiplier: 0.95,
    description: 'Weekend - lighter traffic',
    additionalMinutes: 0,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200'
  }
};

/**
 * Get current traffic condition based on time
 */
export function getCurrentTrafficCondition() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour + minute / 60;
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  if (isWeekend) {
    return TRAFFIC_MULTIPLIERS.weekend;
  }

  if (currentTime >= 7 && currentTime < 9.5) {
    return TRAFFIC_MULTIPLIERS.rush_morning;
  } else if (currentTime >= 17 && currentTime < 20) {
    return TRAFFIC_MULTIPLIERS.rush_evening;
  } else if (currentTime >= 9.5 && currentTime < 17) {
    return TRAFFIC_MULTIPLIERS.midday;
  } else {
    return TRAFFIC_MULTIPLIERS.night;
  }
}

/**
 * Calculate fare for a ride
 */
export function calculateFare(distanceKm, estimatedMinutes, rateCard, options = {}) {
  const { includeTraffic = true, trafficCondition = null } = options;

  const traffic = trafficCondition || (includeTraffic ? getCurrentTrafficCondition() : null);

  const adjustedMinutes = traffic 
    ? estimatedMinutes + traffic.additionalMinutes
    : estimatedMinutes;

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
    timestamp: new Date().toISOString(),
    distance: distanceKm,
    baseTime: estimatedMinutes
  };

  Object.entries(rates).forEach(([key, rateCard]) => {
    results.uber[key] = calculateFare(distanceKm, estimatedMinutes, rateCard, { trafficCondition: traffic });
  });

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
 * Get traffic icon and color
 */
export function getTrafficInfo() {
  const traffic = getCurrentTrafficCondition();
  return {
    icon: traffic.multiplier > 1.2 ? '🚦' : traffic.multiplier > 1 ? '🚗' : '🛣️',
    color: traffic.color,
    bgColor: traffic.bgColor,
    borderColor: traffic.borderColor,
    ...traffic
  };
}

/**
 * DISCLAIMER TEXT
 */
export const FARE_DISCLAIMER = {
  en: "Estimated fares based on August 2024 rates. Actual fare may vary due to real-time demand, route taken, and traffic conditions. Final price shown in the app before confirming your ride.",
  sw: "Bei zilizokadiria kulingana na viwango vya Agosti 2024. Bei halisi inaweza kutofautiana kutokana na mahitaji ya wakati halisi, njia iliyochukuliwa, na hali ya trafiki. Bei ya mwisho inaonyeshwa kwenye programu kabla ya kuthibitisha safari yako."
};
