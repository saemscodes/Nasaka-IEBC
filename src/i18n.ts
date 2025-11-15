import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Define the structure of our language resources
interface LanguageResources {
  [key: string]: {
    nasaka: any;
  };
}

// Supported languages with their native names
export const SUPPORTED_LANGUAGES = {
  en: { code: 'en', name: 'English', nativeName: 'English' },
  sw: { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili' },
  kik: { code: 'kik', name: 'Kikuyu', nativeName: 'Gĩkũyũ' },
  luo: { code: 'luo', name: 'Luo', nativeName: 'Dholuo' },
  maa: { code: 'maa', name: 'Maasai', nativeName: 'Maa' },
  mer: { code: 'mer', name: 'Meru', nativeName: 'Kĩmĩĩru' },
  kam: { code: 'kam', name: 'Kamba', nativeName: 'Kikamba'}
};

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

// Base resources - English fallback
const resources: LanguageResources = {
  en: {
    nasaka: {
      common: {
        changeLanguage: "Change language",
        language: "Language",
        longPressHint: "Long press for quick access",
        loading: "Loading...",
        error: "Error",
        retry: "Retry",
        cancel: "Cancel",
        close: "Close",
        save: "Save",
        continue: "Continue",
        back: "Back",
        next: "Next",
        submit: "Submit",
        search: "Search",
        filter: "Filter",
        select: "Select",
        optional: "Optional",
        required: "Required"
      },
      splash: {
        title: "NASAKA",
        subtitle: "IEBC",
        description: "Find Your Nearest IEBC Office",
        disclaimer: "Allow location access to find the closest IEBC registration center and get turn-by-turn navigation.",
        allowLocation: "Allow Location Access",
        manualEntry: "Enter Location Manually",
        locationBlocked: "Location Blocked",
        locationBlockedDescription: "Please enable location in your browser settings and reload",
        locating: "Getting your location...",
        visitCeka: "Visit CEKA Community",
        switchToLight: "Switch to light mode",
        switchToDark: "Switch to dark mode"
      },
      search: {
        placeholder: "Search IEBC offices by county, constituency, or location...",
        searching: "Searching IEBC offices...",
        searchFor: "Search for \"{{query}}\"",
        findAllMatching: "Find all matching IEBC offices",
        resultsCount_one: "{{count}} office found",
        resultsCount_other: "{{count}} offices found",
        noOfficesFound: "No offices found",
        noMatchQuery: "No offices match \"{{query}}\". Try a different search.",
        noOfficesInArea: "No IEBC offices found in your area.",
        useCurrentLocation: "Use current location",
        searchResult: "Search Result",
        query: "Query"
      },
      office: {
        tapForDirections: "Tap for directions",
        noLocationAccess: "No location access",
        distance: "{{distance}} km",
        veryClose: "Very close",
        nearby: "Nearby",
        driveAway: "Drive away",
        far: "Far",
        location: "Location",
        locationUnavailable: "Location Unavailable",
        officeName: "IEBC Office"
      },
      bottomSheet: {
        locationAccessRequired: "Location Access Required",
        locationAccessDesc: "Enable location access to see fare estimates, get directions from your current location, and find the nearest route to this office.",
        enableLocationAccess: "Enable Location Access",
        estimatedRideCost: "Estimated Ride Cost",
        routesFound: "{{count}} route found",
        routesFound_one: "{{count}} route found",
        routesFound_other: "{{count}} routes found",
        bestRoute: "Best: {{distance}} km, {{time}} min",
        "distance": "Distance",
        routingError: "Failed to calculate route",
        normalTraffic: "Normal traffic",
        showAll: "Show All",
        hide: "Hide",
        cheapestOption: "Cheapest Option",
        estimatedTime: "minutes",
        breakdown: "Breakdown",
        baseFare: "Base Fare",
        perKmRate: "Per KM Rate",
        trafficSurcharge: "Traffic Surcharge",
        total: "Total",
        viewAllOptions: "View All Ride Options",
        navigationOptions: "Navigation Options",
        openInGoogleMaps: "Open in Google Maps",
        openInAppleMaps: "Open in Apple Maps",
        bookRide: "Book a Ride",
        bookWithUber: "Book with Uber",
        bookWithBolt: "Book with Bolt",
        moreInfo: "More Information",
        address: "Address",
        coordinates: "Coordinates",
        copyCoordinates: "Copy Coordinates",
        callOffice: "Call Office",
        reportIssue: "Report an Issue",
        contributeLocation: "Contribute Missing Location",
        confirmOffice: "Community can confirm if this office is real",
        helpVerify: "Help verify this office",
        confirmThis: "Confirm This Office Is Real",
        youConfirmed: "You've confirmed this location",
        peopleConfirmed_one: "{{count}} person has confirmed this location",
        peopleConfirmed_other: "{{count}} people have confirmed this location",
        within500m: "You must be within 500m of the office",
        locationNotStored: "Your exact location is not stored",
        oneConfirmation: "Only one confirmation per device",
        startNavigation: "Start Navigation",
        openInMaps: "Open in Maps",
        confirming: "Confirming...",
        distanceAway: "You're {{distance}}m away. Please move within {{maxDistance}}m of the office to confirm.",
        confirmationFailed: "Failed to submit confirmation. Please try again.",
        locationPermissionRequired: "Location permission is required to confirm. Please enable location access and try again.",
        uberServices: "Uber Services",
        boltServices: "Bolt Services", 
        driveTime: "Drive Time",
        openApp: "Open app",
        trafficSurchargeIncluded: "Prices include traffic surcharge",
        coordinatesCopied: "Coordinates copied to clipboard!",
        copyCoordinatesPrompt: "Copy coordinates:"
      },
      officeList: {
        searchResults: "Search Results",
        nearbyOffices: "Nearby Offices",
        closePanel: "Close panel",
        showAllOffices: "Show all offices"
      },
      layers: {
        mapLayers: "Map Layers",
        customizeView: "Customize your map view",
        baseMap: "Base Map",
        standard: "Standard",
        standardDesc: "Default street map view",
        satellite: "Satellite",
        satelliteDesc: "Aerial imagery view",
        dataLayers: "Data Layers",
        iebcOffices: "IEBC Offices",
        iebcOfficesDesc: "All IEBC office locations across Kenya",
        constituencies: "Kenya Constituencies",
        constituenciesDesc: "Parliamentary and electoral boundaries across Kenya as defined by IEBC. Each polygon represents one constituency with its corresponding code and name.",
        healthcareFacilities: "Kenya Healthcare Facilities",
        healthcareFacilitiesDesc: "Distribution of healthcare facilities across the country (large dataset — may take a few extra moments to load)",
        counties: "Kenya Counties Voters Data",
        countiesDesc: "Distribution of county borders across the country",
        myLocation: "My Location",
        myLocationDesc: "Show your current location on the map",
        locationPermissionRequired: "Location permission required",
        aboutLayers: "About Layers",
        aboutLayersDesc: "Toggle layers on and off to customize your map view. You can combine multiple data layers with different base maps for the best experience."
      },
      contribute: {
        title: "Contribute Missing Office Location",
        description: "Help us map all IEBC offices across Kenya by contributing accurate location data.",
        close: "Close",
        selectCounty: "1. Select County",
        selectCountyPlaceholder: "Choose county...",
        selectConstituency: "2. Select Constituency",
        selectConstituencyPlaceholder: "Choose constituency...",
        enterLocation: "3. Enter Office Location",
        officeName: "Office Name (Optional)",
        officeNamePlaceholder: "e.g., IEBC Westlands Office",
        currentLocationTab: "Current Location",
        useCurrentLocation: "Use Current Location",
        enableLocation: "Enable Location",
        enterCoordinatesTab: "Enter Coordinates",
        latitude: "Latitude",
        latitudePlaceholder: "e.g., -1.2864",
        longitude: "Longitude",
        longitudePlaceholder: "e.g., 36.8172",
        googleMapsTab: "Google Maps Link",
        googleMapsPlaceholder: "Paste Google Maps link or coordinates",
        uploadEvidence: "4. Upload Evidence (Optional)",
        uploadEvidenceDesc: "Photo of the office, signage, or surrounding area helps verification",
        dragDropOrClick: "Drag & drop or click to upload",
        uploadedImage: "Uploaded Image",
        removeImage: "Remove image",
        additionalInfo: "5. Additional Information (Optional)",
        landmarkPlaceholder: "Nearby landmark or description...",
        phoneNumber: "Phone Number",
        phoneNumberPlaceholder: "e.g., +254 712 345 678",
        email: "Email Address",
        emailPlaceholder: "e.g., office@iebc.or.ke",
        yourContact: "6. Your Contact (Optional)",
        yourEmail: "Your Email",
        yourEmailPlaceholder: "For follow-up only",
        reviewAndSubmit: "7. Review & Submit",
        locationPreview: "Location Preview",
        movePin: "Drag the pin to adjust the exact location",
        locationAccuracyGood: "Good accuracy",
        locationAccuracyFair: "Fair accuracy",
        locationAccuracyPoor: "Poor accuracy",
        submitting: "Submitting...",
        submitContribution: "Submit Contribution",
        submissionSuccess: "Success!",
        submissionSuccessDesc: "Your contribution has been submitted and will be reviewed by moderators.",
        submissionId: "Submission ID",
        submissionNote: "Note: Community verification helps improve accuracy. Thank you for contributing!",
        closeWindow: "Close Window",
        errorTitle: "Submission Error",
        errorCounty: "Please select a county",
        errorConstituency: "Please select a constituency",
        errorLocation: "Please provide office location coordinates",
        errorInvalidCoordinates: "Invalid coordinates. Please check latitude and longitude values.",
        errorSubmissionFailed: "Failed to submit contribution. Please try again.",
        gettingLocation: "Getting your location...",
        errorLocationPermission: "Location permission denied. Please enable location access.",
        errorLocationFailed: "Failed to get location. Please try manually entering coordinates.",
        parseError: "Invalid format. Please paste a valid Google Maps link or coordinates.",
        countyRequired: "County is required",
        constituencyRequired: "Constituency is required",
        locationRequired: "Office location is required"
      },
      uber: {
        chooseRide: "Choose Uber Ride",
        selectPreferred: "Select your preferred ride type",
        noDiscount: "(No discount applied)",
        chapChap: "Chap Chap",
        chapChapDesc: "Motorcycle taxis - Fast & affordable",
        uberX: "UberX",
        uberXDesc: "Everyday affordable rides",
        comfort: "Comfort",
        comfortDesc: "Newer cars with extra legroom",
        uberXL: "UberXL",
        uberXLDesc: "Larger vehicles for groups",
        priceUnavailable: "Price unavailable",
        cancel: "Cancel"
      }
    }
  }
};

// Function to dynamically load a language - FIXED IMPLEMENTATION
export const loadLanguage = async (lng: LanguageCode): Promise<boolean> => {
  // If we already have the language loaded, return true
  if (resources[lng]) {
    console.log(`Language ${lng} already loaded`);
    return true;
  }

  try {
    console.log(`Loading language: ${lng}`);
    
    // Dynamic import based on language code
    let module;
    switch (lng) {
      case 'sw':
        module = await import('@/locales/sw/nasaka.json');
        break;
      case 'kik':
        module = await import('@/locales/kik/nasaka.json');
        break;
      case 'luo': 
        module = await import('@/locales/luo/nasaka.json');
        break;
      case 'maa': 
        module = await import('@/locales/maa/nasaka.json');
        break;
      case 'mer': 
        module = await import('@/locales/mer/nasaka.json');
        break;  
      case 'kam': 
        module = await import('@/locales/kam/nasaka.json');
        break;    
      default:
        // For any other language, try to import dynamically
        try {
          module = await import(`@/locales/${lng}/nasaka.json`);
        } catch {
          console.warn(`Language ${lng} not found, falling back to English`);
          return false;
        }
    }
    
    // Add the loaded resources
    resources[lng] = {
      nasaka: module.default
    };
    
    // CRITICAL FIX: Update i18n with the new resources
    i18n.addResourceBundle(lng, 'nasaka', module.default, true, true);
    
    console.log(`Successfully loaded language: ${lng}`);
    return true;
  } catch (error) {
    console.error(`Failed to load language ${lng}:`, error);
    return false;
  }
};

// Enhanced language detector - FIXED IMPLEMENTATION
const customLanguageDetector = {
  type: 'languageDetector' as const,
  async: true,
  init: () => {},
  detect: (callback: (lng: string) => void) => {
    const savedLanguage = localStorage.getItem('nasaka_language');
    console.log('Saved language from storage:', savedLanguage);
    
    if (savedLanguage && SUPPORTED_LANGUAGES[savedLanguage as LanguageCode]) {
      console.log('Using saved language:', savedLanguage);
      return callback(savedLanguage);
    }

    const browserLanguage = navigator.language.split('-')[0];
    console.log('Browser language detected:', browserLanguage);
    
    if (SUPPORTED_LANGUAGES[browserLanguage as LanguageCode]) {
      console.log('Using browser language:', browserLanguage);
      return callback(browserLanguage);
    }

    console.log('Falling back to English');
    callback('en');
  },
  cacheUserLanguage: (lng: string) => {
    console.log('Caching language:', lng);
    localStorage.setItem('nasaka_language', lng);
  }
};

// Initialize i18n - FIXED CONFIGURATION
i18n
  .use(customLanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: Object.keys(SUPPORTED_LANGUAGES),
    defaultNS: 'nasaka',
    ns: ['nasaka'],
    
    // Enhanced interpolation settings - CRITICAL FIX
    interpolation: {
      escapeValue: false,
      nestingPrefix: '{{',
      nestingSuffix: '}}',
      // CRITICAL: Always format interpolated values as strings
      format: (value, format, lng) => {
        // Ensure value is always a string to prevent split() errors
        if (value === null || value === undefined) {
          console.warn('Interpolation value is null/undefined:', { format, lng });
          return '';
        }
        // Convert to string if not already
        return String(value);
      }
    },

    // Enhanced error handling - CRITICAL FIX
    saveMissing: false,
    parseMissingKeyHandler: (key: string) => {
      console.warn(`Translation key missing: ${key}`);
      // Return a formatted version of the key for development
      if (process.env.NODE_ENV === 'development') {
        // Extract the last part of the key for a more user-friendly fallback
        const parts = key.split('.');
        const lastPart = parts[parts.length - 1];
        // Convert camelCase to spaces
        const formatted = lastPart.replace(/([A-Z])/g, ' $1').trim();
        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
      }
      // In production, return empty string to avoid key leaks
      return '';
    },

    // Performance optimizations
    react: {
      useSuspense: false, // CHANGED TO FALSE FOR BETTER ERROR HANDLING
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p', 'span'],
    },

    // Detection settings
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'nasaka_language'
    }
  });

// Preload supported languages on startup
export const preloadLanguages = async () => {
  const languages = Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[];
  console.log('Preloading languages:', languages);
  
  for (const lng of languages) {
    if (lng !== 'en') {
      await loadLanguage(lng);
    }
  }
  console.log('Language preloading completed');
};

// Auto-discover available languages
export const discoverLanguages = async (): Promise<LanguageCode[]> => {
  return Object.keys(SUPPORTED_LANGUAGES) as LanguageCode[];
};

// Initialize language loading
preloadLanguages().catch(console.error);

// Export the i18n instance
export default i18n;
