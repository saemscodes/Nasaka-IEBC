import { LANGUAGES } from './languages.generated';

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
  flag?: string;
}

export interface LanguagePersonality {
  mass: number;
  damping: number;
  stiffness: number;
  floatAmplitude: number;
  floatFrequency: number;
  floatPhase: number;
  rotationRange: number;
  color: string;
}

export const LANGUAGE_PERSONALITIES: Record<string, LanguagePersonality> = {
  en: {
    mass: 1.0,
    damping: 0.85,
    stiffness: 150,
    floatAmplitude: 3, // Reduced for 20px radius
    floatFrequency: 2.5,
    floatPhase: 0,
    rotationRange: 2,
    color: '#3b82f6'
  },
  sw: {
    mass: 0.9,
    damping: 0.88,
    stiffness: 140,
    floatAmplitude: 4, // Reduced for 20px radius
    floatFrequency: 2.0,
    floatPhase: 120,
    rotationRange: 3,
    color: '#10b981'
  },
  ki: {
    mass: 1.1,
    damping: 0.82,
    stiffness: 130,
    floatAmplitude: 5, // Reduced for 20px radius
    floatFrequency: 1.8,
    floatPhase: 240,
    rotationRange: 4,
    color: '#8b5cf6'
  }
};

export const getAvailableLanguages = (): LanguageConfig[] => {
  return LANGUAGES;
};

export const getLanguagePersonality = (code: string): LanguagePersonality => {
  return LANGUAGE_PERSONALITIES[code] || LANGUAGE_PERSONALITIES.en;
};

export const getCurrentLanguage = (): LanguageConfig => {
  const currentCode = typeof window !== 'undefined' 
    ? window.localStorage.getItem('nasaka_language') || 'en'
    : 'en';
  
  return LANGUAGES.find(lang => lang.code === currentCode) || LANGUAGES[0];
};
