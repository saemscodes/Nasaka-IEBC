import { useEffect, useState, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';
import { RefreshCw, Download, CheckCircle, WifiOff, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PWARegistrationProps {
  onOfflineReady?: () => void;
  onNeedRefresh?: () => void;
  onRegistered?: () => void;
}

export const PWARegistration: React.FC<PWARegistrationProps> = ({
  onOfflineReady,
  onNeedRefresh,
  onRegistered
}) => {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('SW Registered:', registration);
      setRegistrationComplete(true);
      onRegistered?.();
      
      // Check for updates periodically
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      }
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    },
    onOfflineReady() {
      console.log('App ready for offline use');
      setOfflineReady(true);
      onOfflineReady?.();
      
      toast.success('App ready for offline use', {
        description: 'IEBC offices data has been cached locally',
        duration: 4000,
        icon: <CheckCircle className="w-4 h-4 text-green-500" />
      });
    },
    onNeedRefresh() {
      console.log('New content available');
      setNeedRefresh(true);
      setShowUpdatePrompt(true);
      onNeedRefresh?.();
    }
  });

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online', {
        description: 'Syncing latest data...',
        icon: <Wifi className="w-4 h-4 text-green-500" />
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline', {
        description: 'Using cached data',
        icon: <WifiOff className="w-4 h-4 text-amber-500" />
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true);
    setShowUpdatePrompt(false);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setShowUpdatePrompt(false);
  }, []);

  // Update available toast
  useEffect(() => {
    if (showUpdatePrompt && needRefresh) {
      toast.info('Update available', {
        description: 'A new version is available. Refresh to update.',
        duration: Infinity,
        action: {
          label: 'Update',
          onClick: handleUpdate
        },
        cancel: {
          label: 'Later',
          onClick: dismissUpdate
        },
        icon: <RefreshCw className="w-4 h-4 text-blue-500" />
      });
    }
  }, [showUpdatePrompt, needRefresh, handleUpdate, dismissUpdate]);

  return null; // This component handles everything via toasts
};

// Hook for checking PWA install capability
export const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      if ((navigator as any).standalone === true) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkInstalled()) return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setInstallPrompt(null);
      toast.success('App installed!', {
        description: 'You can now use Nasaka offline',
        icon: <Download className="w-4 h-4 text-green-500" />
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setCanInstall(false);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Install prompt error:', error);
      return false;
    }
  }, [installPrompt]);

  return {
    canInstall,
    isInstalled,
    promptInstall
  };
};

// Types for install prompt
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export default PWARegistration;
