import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Gift, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type DonationOptionBase = {
  id: string;
  name: string;
  type: 'link' | 'copy' | 'paybill' | 'qr' | 'phone' | 'custom';
  url?: string;
  description?: string;
  icon?: string;
  copyText?: string;
  paybillNumber?: string;
  accountNumber?: string;
  paybillInstruction?: string;
  qrImageSrc?: string;
};

const DONATION_OPTIONS: DonationOptionBase[] = [
  {
    id: 'mpesa_paybill',
    name: 'M-Pesa Paybill',
    type: 'paybill',
    icon: '🏦',
    description: 'Support our civic education mission',
    paybillNumber: '4573966',
    accountNumber: '39928',
    paybillInstruction: 'M-Pesa → Lipa na M-PESA → Paybill',
    qrImageSrc: '/assets/qr-code-donations.png',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'link',
    icon: '💳',
    url: 'https://www.paypal.com/ncp/payment/5HP7FN968RTH6',
    description: 'International card donations'
  }
];

const MAX_WIDGET_DISPLAY_TIME = 20 * 60 * 1000;

interface DonationWidgetProps {
  onTimedOut?: () => void;
  isVisible?: boolean;
  offsetY?: number;
  onClose?: () => void;
}

const safeCopy = async (text: string, toast: any) => {
  try {
    await navigator.clipboard.writeText(text);
    toast?.({
      title: 'Copied',
      description: 'Copied to clipboard',
      duration: 2500
    });
  } catch (err) {
    const fallback = window.prompt('Copy this text:', text);
    if (fallback !== null && toast) {
      toast({ title: 'Copied', description: 'Copied to clipboard (fallback)', duration: 2500 });
    }
  }
};

const safeOpen = (href?: string) => {
  if (!href) return;
  window.open(href, '_blank', 'noopener,noreferrer');
};

const DonationWidget: React.FC<DonationWidgetProps> = ({ 
  onTimedOut, 
  isVisible: controlledVisibility, 
  offsetY = 140, 
  onClose 
}) => {
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
          <div className="relative w-40 h-10 flex items-center">
            <div 
              className={`absolute right-10 top-0 h-10 flex items-center transition-all duration-500 ease-out ${
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
                className={`relative px-3 py-1 text-white font-semibold text-sm whitespace-nowrap transition-all duration-500 ease-out drop-shadow-lg ${
                  isHovering 
                    ? 'opacity-100 scale-100' 
                    : 'opacity-0 scale-90'
                }`}
              >
                Support Us
              </span>
            </div>
            <div 
              className={`absolute right-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ease-out shadow-2xl ${
                isHovering
                  ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 shadow-blue-500/50 scale-110'
                  : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-blue-600/40 scale-100'
              }`}
            >
              <div className="absolute inset-1 rounded-full bg-gradient-to-br from-blue-300/30 to-transparent" />
              <Heart 
                className={`relative z-10 transition-all duration-300 ease-out ${
                  isHovering 
                    ? 'h-5 w-5 text-white drop-shadow-lg' 
                    : 'h-4 w-4 text-white/90'
                }`} 
              />
              <div 
                className={`absolute inset-0 rounded-full bg-blue-400 transition-all duration-1000 ease-out ${
                  isHovering 
                    ? 'animate-ping opacity-20' 
                    : 'opacity-0'
                }`} 
              />
            </div>
          </div>
          {isHovering && (
            <>
              <div className="absolute top-1 right-1 w-1 h-1 bg-blue-300 rounded-full animate-bounce opacity-60" style={{ animationDelay: '0s' }} />
              <div className="absolute top-3 right-4 w-0.5 h-0.5 bg-blue-200 rounded-full animate-bounce opacity-40" style={{ animationDelay: '0.2s' }} />
              <div className="absolute top-4 right-2 w-1 h-1 bg-blue-400 rounded-full animate-bounce opacity-50" style={{ animationDelay: '0.4s' }} />
            </>
          )}
        </div>
      ) : (
        <div className="w-72 bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl border border-white/20 dark:border-gray-700/20 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 dark:from-blue-400/10 dark:to-blue-500/10 p-3 border-b border-white/10 dark:border-gray-700/10">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center text-gray-900 dark:text-white">
                <div className="relative mr-2">
                  <Gift className="h-5 w-5 text-blue-500 dark:text-blue-400 drop-shadow-sm" />
                  <div className="absolute inset-0 bg-blue-400 blur-sm opacity-30 rounded-full" />
                </div>
                Support Our Work
              </h3>
              <button
                className="relative group rounded-full p-1 hover:bg-white/10 dark:hover:bg-gray-800/10 transition-all duration-300 backdrop-blur-sm"
                onClick={handleCollapse}
              >
                <X className="h-3 w-3 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                <div className="absolute inset-0 rounded-full bg-white/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
              </button>
            </div>
          </div>
          <div className="p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
              Your support helps us continue our mission of civic education in Kenya.
            </p>
            
            <div className="space-y-3">
              {DONATION_OPTIONS.map((option, index) => (
                <div
                  key={option.id}
                  className="group relative p-3 rounded-xl hover:bg-white/10 dark:hover:bg-gray-800/10 transition-all duration-300 border border-white/10 dark:border-gray-700/10 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 80}ms` }}
                  aria-label={option.name}
                >
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 dark:via-gray-700/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative z-10">
                    <div className="flex items-center mb-2">
                      <div className="text-xl mr-3 transition-transform duration-300 group-hover:scale-110" aria-hidden>
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{option.name}</p>
                        {option.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {option.type === 'paybill' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              Paybill: {option.paybillNumber}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              Account: {option.accountNumber}
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button
                              onClick={() => safeCopy(`${option.paybillNumber} ${option.accountNumber}`, toast)}
                              className="px-2 py-1 text-xs rounded-lg flex items-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-300 text-gray-700 dark:text-gray-300 shadow"
                              aria-label={`Copy paybill details`}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </button>
                            <a
                              href="https://zenlipa.co.ke/tip/civic-education-kenya"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-xs rounded-lg flex items-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-300 text-gray-700 dark:text-gray-300 shadow"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Zenlipa
                            </a>
                          </div>
                        </div>
                        {option.paybillInstruction && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {option.paybillInstruction}
                          </div>
                        )}
                        {option.qrImageSrc && (
                          <div className="flex justify-center mt-2">
                            <img 
                              src={option.qrImageSrc} 
                              alt={`${option.name} QR Code`} 
                              className="w-28 h-28 object-contain rounded border border-gray-200 dark:border-gray-700"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {option.type === 'link' && option.url && (
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex-1">
                          <a
                            href={option.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-2 text-sm rounded-lg flex items-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-300 text-gray-700 dark:text-gray-300 shadow"
                          >
                            <span className="mr-2">Visit</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <button
              className="w-full mt-4 py-2 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white transition-all duration-300 shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] backdrop-blur-sm text-sm"
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
