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
  extraActions?: Array<{
    label: string;
    href?: string;
    onClickAction?: 'copy' | 'open' | 'tel';
    value?: string;
  }>;
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
    qrImageSrc: '/assets/qr-code-donations.png',
    extraActions: [
      {
        label: 'ZenLipa',
        href: 'https://zenlipa.co.ke/tip/civic-education-kenya',
        onClickAction: 'open'
      }
    ]
  },
  {
    id: 'paypal',
    name: 'PayPal',
    type: 'link',
    icon: '💳',
    url: 'https://www.paypal.com/ncp/payment/5HP7FN968RTH6',
    description: 'International card donations'
  },
  {
    id: 'zenlipa_mpesa',
    name: 'ZenLipa',
    type: 'link',
    icon: '🔗',
    url: 'https://zenlipa.co.ke/tip/civic-education-kenya',
    description: 'M-Pesa & card payments'
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
                className={`relative px-3 py-1 text-white font-semibold text-xs whitespace-nowrap transition-all duration-500 ease-out drop-shadow-lg ${
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
        <div className="w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border border-white/30 dark:border-gray-700/30 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500/15 to-blue-600/15 dark:from-blue-400/15 dark:to-blue-500/15 p-4 border-b border-white/20 dark:border-gray-700/20">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center text-gray-900 dark:text-white">
                <div className="relative mr-3">
                  <Gift className="h-6 w-6 text-blue-500 dark:text-blue-400 drop-shadow-sm" />
                  <div className="absolute inset-0 bg-blue-400 blur-sm opacity-30 rounded-full" />
                </div>
                Support Our Work
              </h3>
              <button
                className="relative group rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-300 backdrop-blur-sm"
                onClick={handleCollapse}
              >
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors" />
                <div className="absolute inset-0 rounded-full bg-black/5 dark:bg-white/5 scale-0 group-hover:scale-100 transition-transform duration-300" />
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
                  key={option.id}
                  className="group relative p-4 rounded-xl bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all duration-300 border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 80}ms` }}
                  aria-label={option.name}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start flex-1 min-w-0">
                      <div className="text-2xl mr-3 transition-transform duration-300 group-hover:scale-110 flex-shrink-0" aria-hidden>
                        {option.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white mb-1 truncate">{option.name}</p>

                        {option.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                            {option.description}
                          </p>
                        )}

                        {option.type === 'paybill' && (
                          <div className="space-y-2">
                            <div className="flex items-baseline space-x-2">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {option.paybillNumber}
                              </div>
                            </div>
                            {option.accountNumber && (
                              <div className="text-xs text-gray-600 dark:text-gray-300">
                                Account: <span className="font-medium">{option.accountNumber}</span>
                              </div>
                            )}
                            
                            <button
                              onClick={() => safeCopy(`${option.paybillNumber} ${option.accountNumber}`, toast)}
                              className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-blue-500/25 active:scale-95"
                            >
                              <Copy className="h-3 w-3" />
                              <span className="text-xs">Copy Details</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {option.type === 'paybill' && option.qrImageSrc && (
                      <div className="flex flex-col items-end space-y-2 ml-3">
                        <img 
                          src={option.qrImageSrc} 
                          alt={`${option.name} QR Code`} 
                          className="w-16 h-16 object-contain rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
                        />
                        {Array.isArray(option.extraActions) && option.extraActions.length > 0 && (
                          <button
                            onClick={() => {
                              const action = option.extraActions![0];
                              if (action.href) safeOpen(action.href);
                            }}
                            className="px-3 py-1.5 text-xs rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-all duration-300 shadow-lg hover:shadow-green-500/25 active:scale-95 flex items-center space-x-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>ZenLipa</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {option.type !== 'paybill' && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          if (option.type === 'link' && option.url) safeOpen(option.url);
                        }}
                        className="w-full py-2.5 px-3 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-blue-500/25 active:scale-95"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-sm">Donate with {option.name}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button
              className="w-full mt-4 py-3 rounded-xl font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-300 shadow-lg hover:shadow-gray-500/10 active:scale-95 backdrop-blur-sm"
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
