import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                           (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Check for iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show banner after 5 seconds on page
      setTimeout(() => {
        if (!isStandaloneMode) {
          setIsVisible(true);
        }
      }, 5000);
    };

    // Check if PWA is already installed
    if (isStandaloneMode) {
      return;
    }

    // Listen for install prompt
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show custom instructions
    if (isIOSDevice && !isStandaloneMode) {
      const hasSeenBanner = localStorage.getItem('pwa-ios-banner-seen');
      if (!hasSeenBanner) {
        setTimeout(() => setIsVisible(true), 3000);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
        localStorage.setItem('pwa-install-accepted', 'true');
      }
      
      setDeferredPrompt(null);
      setIsVisible(false);
    }
  };

  const handleIOSInstructions = () => {
    localStorage.setItem('pwa-ios-banner-seen', 'true');
    setIsVisible(false);
    // You could open a modal with iOS-specific instructions here
    alert('To install this app:\n1. Tap the Share button\n2. Scroll down and tap "Add to Home Screen"\n3. Tap "Add" in the top right');
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (isIOS) {
      localStorage.setItem('pwa-ios-banner-seen', 'true');
    }
  };

  if (!isVisible || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl shadow-2xl p-4 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-xl">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Install Nasaka IEBC</h3>
                <p className="text-sm text-blue-100 opacity-90">
                  {isIOS 
                    ? 'Add to home screen for quick access' 
                    : 'Install app for offline use and faster loading'}
                </p>
              </div>
            </div>
            
            <div className="mt-4 flex gap-2">
              {!isIOS && deferredPrompt ? (
                <button
                  onClick={handleInstallClick}
                  className="flex-1 bg-white text-blue-700 font-semibold py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Install App
                </button>
              ) : (
                <button
                  onClick={handleIOSInstructions}
                  className="flex-1 bg-white text-blue-700 font-semibold py-3 px-4 rounded-xl hover:bg-blue-50 transition-colors"
                >
                  {isIOS ? 'Show Instructions' : 'Install'}
                </button>
              )}
              
              <button
                onClick={handleDismiss}
                className="px-4 py-3 text-white/80 hover:text-white transition-colors rounded-xl hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom hook for PWA detection
export const usePWA = () => {
  const [isPWA, setIsPWA] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        (window.navigator as any).standalone === true;
    setIsPWA(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return false;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setCanInstall(false);
      setIsPWA(true);
      return true;
    }
    
    return false;
  };

  return { isPWA, canInstall, installPWA };
};