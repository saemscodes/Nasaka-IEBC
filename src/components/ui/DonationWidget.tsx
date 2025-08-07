import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Gift, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DONATION_OPTIONS = [
  {
    name: 'Ko-fi',
    url: 'https://ko-fi.com/civiceducationkenya',
    description: 'Support us with a coffee',
    icon: '☕'
  },
  {
    name: 'PayPal',
    url: 'https://www.paypal.com/ncp/payment/5HP7FN968RTH6',
    description: 'Donate via PayPal',
    icon: '💳'
  },
  {
    name: 'M-Pesa',
    number: '+254798903373',
    description: 'Send to M-Pesa',
    icon: '📱'
  }
];

const MAX_WIDGET_DISPLAY_TIME = 20 * 60 * 1000;

interface DonationWidgetProps {
  onTimedOut?: () => void;
  isVisible?: boolean;
  offsetY?: number;
  onClose?: () => void;
}

const DonationWidget: React.FC<DonationWidgetProps> = ({ onTimedOut, isVisible: controlledVisibility, offsetY = 140, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const [opacity, setOpacity] = useState(1);
  
  const widgetMountTimeRef = useRef<number>(Date.now());
  const visibilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverInactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const opacityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const clearTimers = () => {
    [visibilityTimerRef, timeoutTimerRef, hoverInactivityTimerRef, opacityTimerRef].forEach(timerRef => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });
  };

  useEffect(() => {
    if (isHovering || isExpanded) {
      setOpacity(1);
      if (opacityTimerRef.current) {
        clearTimeout(opacityTimerRef.current);
        opacityTimerRef.current = null;
      }
    } else {
      opacityTimerRef.current = setTimeout(() => {
        setOpacity(0.2);
      }, 5000);
    }

    return () => {
      if (opacityTimerRef.current) {
        clearTimeout(opacityTimerRef.current);
      }
    };
  }, [isHovering, isExpanded]);

  const handleMouseEnter = () => {
    if (!isExpanded) {
      setIsHovering(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isExpanded) {
      setIsHovering(false);
    }
  };

  useEffect(() => {
    if (controlledVisibility !== undefined) {
      setIsVisible(controlledVisibility);
      return;
    }

    visibilityTimerRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 5000);
    
    timeoutTimerRef.current = setTimeout(() => {
      if (!isExpanded) {
        setIsVisible(false);
        setHasTimedOut(true);
        if (onTimedOut) onTimedOut();
      }
    }, MAX_WIDGET_DISPLAY_TIME);
    
    return clearTimers;
  }, [isExpanded, onTimedOut, controlledVisibility]);

  const handleExpand = () => {
    setIsExpanded(true);
  };

  const handleCollapse = () => {
    setIsExpanded(false);
    if (onClose) {
      onClose();
    }
  };

  const handleMpesa = () => {
    navigator.clipboard.writeText('+254798903373');
    toast({
      title: "M-Pesa number copied",
      description: "Number copied to clipboard. You can proceed to send your MPesa donation there via 'Send Money'",
      duration: 3000,
    });
  };

  if (hasTimedOut || !isVisible) return null;

  return (
  <div
    data-donation-trigger
    className="fixed z-30 transition-all duration-500 ease-out"
    style={{
      zIndex: 30,
      opacity,
      bottom: `${offsetY}px`,
      ...(isExpanded ? {
        top: '50%',
        bottom: 'auto',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      } : {
        right: '2rem',
      })
    }}
  >
      {!isExpanded ? (
        <div
          className="relative group cursor-pointer"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={handleExpand}
        >
          <div className="relative w-48 h-12 flex items-center">
            <div 
              className={`absolute right-12 top-0 h-12 flex items-center transition-all duration-500 ease-out ${
                isHovering 
                  ? 'opacity-100 translate-x-0' 
                  : 'opacity-0 translate-x-4 pointer-events-none'
              }`}
            >
              <div 
                className={`absolute inset-0 rounded-full transition-all duration-500 ease-out ${
                  isHovering 
                    ? 'bg-black/20 backdrop-blur-sm scale-100' 
                    : 'bg-black/0 backdrop-blur-none scale-75'
                }`} 
              />
              <span 
                className={`relative px-4 py-2 text-white font-semibold text-sm whitespace-nowrap transition-all duration-500 ease-out drop-shadow-lg ${
                  isHovering 
                    ? 'opacity-100 scale-100' 
                    : 'opacity-0 scale-90'
                }`}
              >
                Support Us
              </span>
            </div>
            <div 
              className={`absolute right-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ease-out shadow-2xl ${
                isHovering
                  ? 'bg-gradient-to-br from-red-400 via-red-500 to-red-600 shadow-red-500/50 scale-110'
                  : 'bg-gradient-to-br from-red-500 via-red-600 to-red-700 shadow-red-600/40 scale-100'
              }`}
            >
              <div className="absolute inset-1 rounded-full bg-gradient-to-br from-red-300/30 to-transparent" />
              <Heart 
                className={`relative z-10 transition-all duration-300 ease-out ${
                  isHovering 
                    ? 'h-6 w-6 text-white drop-shadow-lg' 
                    : 'h-5 w-5 text-white/90'
                }`} 
              />
              <div 
                className={`absolute inset-0 rounded-full bg-red-400 transition-all duration-1000 ease-out ${
                  isHovering 
                    ? 'animate-ping opacity-20' 
                    : 'opacity-0'
                }`} 
              />
            </div>
          </div>
          {isHovering && (
            <>
              <div className="absolute top-2 right-2 w-1 h-1 bg-red-300 rounded-full animate-bounce opacity-60" style={{ animationDelay: '0s' }} />
              <div className="absolute top-4 right-6 w-0.5 h-0.5 bg-red-200 rounded-full animate-bounce opacity-40" style={{ animationDelay: '0.2s' }} />
              <div className="absolute top-6 right-3 w-1 h-1 bg-red-400 rounded-full animate-bounce opacity-50" style={{ animationDelay: '0.4s' }} />
            </>
          )}
        </div>
      ) : (
        <div className="w-80 bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl border border-white/20 dark:border-gray-700/20 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 dark:from-red-400/10 dark:to-red-500/10 p-4 border-b border-white/10 dark:border-gray-700/10">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center text-gray-900 dark:text-white">
                <div className="relative mr-3">
                  <Gift className="h-6 w-6 text-green-500 dark:text-green-400 drop-shadow-sm" />
                  <div className="absolute inset-0 bg-green-400 blur-sm opacity-30 rounded-full" />
                </div>
                Support Our Work
              </h3>
              <button
                className="relative group rounded-full p-2 hover:bg-white/10 dark:hover:bg-gray-800/10 transition-all duration-300 backdrop-blur-sm"
                onClick={handleCollapse}
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                <div className="absolute inset-0 rounded-full bg-white/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              </button>
            </div>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
              Your support helps us continue our mission of civic education in Kenya.
            </p>
            <div className="space-y-3">
              {DONATION_OPTIONS.map((option, index) => (
                <div 
                  key={option.name}
                  className="group relative p-4 rounded-xl flex items-center justify-between hover:bg-white/10 dark:hover:bg-gray-800/10 transition-all duration-300 border border-white/10 dark:border-gray-700/10 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 dark:via-gray-700/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="flex items-center relative z-10">
                    <div className="text-2xl mr-4 transition-transform duration-300 group-hover:scale-110">
                      {option.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{option.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{option.description}</p>
                    </div>
                  </div>
                  {option.name === 'M-Pesa' ? (
                    <button
                      onClick={handleMpesa}
                      className="relative z-10 px-4 py-2 text-sm rounded-lg flex items-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 backdrop-blur-sm transition-all duration-300 text-gray-700 dark:text-gray-300 hover:scale-105 shadow-lg"
                    >
                      <span className="mr-2">Copy</span>
                      <Copy className="h-3 w-3" />
                    </button>
                  ) : (
                    <a
                      href={option.url}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="relative z-10 px-4 py-2 text-sm rounded-lg flex items-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 backdrop-blur-sm transition-all duration-300 text-gray-700 dark:text-gray-300 hover:scale-105 shadow-lg"
                    >
                      <span className="mr-2">Visit</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <button
              className="w-full mt-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 dark:from-green-600 dark:to-green-700 dark:hover:from-green-700 dark:hover:to-green-800 text-white transition-all duration-300 shadow-lg hover:shadow-green-500/25 hover:scale-[1.02] backdrop-blur-sm"
              onClick={handleCollapse}
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonationWidget;
