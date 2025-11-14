import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Gift, Copy, ExternalLink, ZoomIn } from 'lucide-react';
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
    description: 'Donate via Paybill (scan QR code below)',
    paybillNumber: '4573966',
    accountNumber: '39928',
    qrImageSrc: '/assets/qr-code-donations.png',
    extraActions: [
      {
        label: 'Copy Details',
        onClickAction: 'copy',
        value: 'Paybill - 4573966, Account - 39928'
      },
      {
        label: 'Link for Direct Payments',
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
    name: 'Zenlipa - MPesa, Card',
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

// QR Modal Component
const QRModal = ({ isOpen, onClose, qrImageSrc, title }: { 
  isOpen: boolean; 
  onClose: () => void; 
  qrImageSrc: string; 
  title: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      {/* Backdrop with strong contrast for QR readability */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/20 p-6 max-w-sm w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center">
            <ZoomIn className="h-5 w-5 mr-2 text-blue-500" />
            Scan QR Code
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* QR Code Image */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-700 mb-4">
          <img 
            src={qrImageSrc} 
            alt={`${title} QR Code`}
            className="w-full h-auto object-contain rounded-lg"
          />
        </div>

        {/* Instructions */}
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Point your camera at the QR code to scan
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {title}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white transition-all duration-300 shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02]"
        >
          Close
        </button>
      </div>
    </div>
  );
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
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [currentQrImage, setCurrentQrImage] = useState('');
  const [currentQrTitle, setCurrentQrTitle] = useState('');
  
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

  const openQrModal = (qrImageSrc: string, title: string) => {
    setCurrentQrImage(qrImageSrc);
    setCurrentQrTitle(title);
    setIsQrModalOpen(true);
  };

  const closeQrModal = () => {
    setIsQrModalOpen(false);
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
    <>
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
          <div className="w-72 bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl border border-white/20 dark:border-gray-700/20 rounded-xl shadow-2xl overflow-hidden">
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
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                Your support helps us continue our mission of civic education in Kenya & advances across the globe.
              </p>
              
              <div className="space-y-3">
                {DONATION_OPTIONS.map((option, index) => (
                  <div
                    key={option.id}
                    className="group relative p-3 rounded-lg flex flex-col hover:bg-white/10 dark:hover:bg-gray-800/10 transition-all duration-300 border border-white/10 dark:border-gray-700/10 backdrop-blur-sm"
                    style={{ animationDelay: `${index * 80}ms` }}
                    aria-label={option.name}
                  >
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/5 dark:via-gray-700/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="flex items-start justify-between relative z-10 mb-2">
                      <div className="flex items-start space-x-2 flex-1 min-w-0">
                        <div className="text-xl mt-0.5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" aria-hidden>
                          {option.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-xs text-gray-900 dark:text-white truncate">{option.name}</p>
                          {option.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {option.description}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {option.type === 'link' && option.url && (
                        <a
                          href={option.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg flex items-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-300 text-gray-700 dark:text-gray-300 shadow ml-2"
                        >
                          <span>Donate</span>
                          <ExternalLink className="h-2.5 w-2.5 ml-1" />
                        </a>
                      )}
                    </div>

                    {option.type === 'paybill' && (
                      <div className="relative z-10 space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900 dark:text-white">Paybill</div>
                            <div className="text-gray-700 dark:text-gray-300 font-mono">{option.paybillNumber}</div>
                          </div>
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900 dark:text-white">Account</div>
                            <div className="text-gray-700 dark:text-gray-300 font-mono">{option.accountNumber}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between space-x-2">
                          {option.qrImageSrc && (
                            <div className="flex-shrink-0 relative">
                              <img 
                                src={option.qrImageSrc} 
                                alt={`${option.name} QR Code`} 
                                className="w-14 h-14 object-contain rounded border border-gray-200 dark:border-gray-700 cursor-pointer hover:scale-105 transition-transform duration-200"
                                onClick={() => openQrModal(option.qrImageSrc!, option.name)}
                              />
                              <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-0.5">
                                <ZoomIn className="h-2.5 w-2.5 text-white" />
                              </div>
                            </div>
                          )}
                          
                          <div className="flex-1 flex flex-col space-y-1">
                            {Array.isArray(option.extraActions) && option.extraActions.map((act, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  if (act.onClickAction === 'copy' && act.value) safeCopy(act.value, toast);
                                  else if (act.onClickAction === 'tel' && act.value) window.location.href = `tel:${act.value}`;
                                  else if (act.href) safeOpen(act.href);
                                }}
                                className="w-full px-2 py-1.5 text-xs rounded flex items-center justify-center bg-white/10 dark:bg-gray-800/10 hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-300 text-gray-700 dark:text-gray-300 shadow"
                                aria-label={act.label || `${option.name} action`}
                              >
                                {act.onClickAction === 'copy' && <Copy className="h-2.5 w-2.5 mr-1" />}
                                <span>{act.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <button
                className="w-full mt-4 py-2.5 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white transition-all duration-300 shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] backdrop-blur-sm text-xs"
                onClick={handleCollapse}
              >
                Maybe Later
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR Modal */}
      <QRModal 
        isOpen={isQrModalOpen}
        onClose={closeQrModal}
        qrImageSrc={currentQrImage}
        title={currentQrTitle}
      />
    </>
  );
};

export default DonationWidget;
