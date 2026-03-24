import React, { useState, useEffect, useRef } from 'react';
import { Heart, X, Gift, ExternalLink, ZoomIn } from 'lucide-react';

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
    name: 'M-Pesa, Airtel Money or Card transaction',
    type: 'paybill',
    icon: '🏦',
    description: 'Donate via Paybill (scan QR code below)',
    paybillNumber: '4573966',
    accountNumber: '39928',
    qrImageSrc: '/assets/QR-CEKA.png',
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

const safeCopy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    window.prompt('Copy this text:', text);
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

  // Copy states
  const [copyStateAll, setCopyStateAll] = useState<'default' | 'loading' | 'success'>('default');
  const [copyStatePaybill, setCopyStatePaybill] = useState<'default' | 'loading' | 'success'>('default');
  const [copyStateAccount, setCopyStateAccount] = useState<'default' | 'loading' | 'success'>('default');

  const widgetMountTimeRef = useRef<number>(Date.now());
  const visibilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hoverInactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const opacityTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Copy Handlers
  const handleCopyDetails = async (text: string, setState: React.Dispatch<React.SetStateAction<'default' | 'loading' | 'success'>>) => {
    setState('loading');
    await safeCopy(text);

    // Artificial delay for UI satisfaction
    setTimeout(() => {
      setState('success');

      // Revert after showing tick
      setTimeout(() => {
        setState('default');
      }, 2000);
    }, 400);
  };

  // Extract paybill data from DONATION_OPTIONS
  const paybillOption = DONATION_OPTIONS.find(opt => opt.id === 'mpesa_paybill');
  const qrImageSrc = paybillOption?.qrImageSrc || '';
  const paybillNumber = paybillOption?.paybillNumber || '';
  const accountNumber = paybillOption?.accountNumber || '';

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
                className={`absolute right-10 top-0 h-10 flex items-center transition-all duration-500 ease-out ${isHovering
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 translate-x-4 pointer-events-none'
                  }`}
              >
                <div
                  className={`absolute inset-0 rounded-full transition-all duration-500 ease-out ${isHovering
                    ? 'bg-black/20 backdrop-blur-sm scale-100'
                    : 'bg-black/0 backdrop-blur-none scale-75'
                    }`}
                />
                <span
                  className={`relative px-3 py-1 text-white font-semibold text-xs whitespace-nowrap transition-all duration-500 ease-out drop-shadow-lg ${isHovering
                    ? 'opacity-100 scale-100'
                    : 'opacity-0 scale-90'
                    }`}
                >
                  Support Us
                </span>
              </div>
              <div
                className={`absolute right-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ease-out shadow-2xl ${isHovering
                  ? 'bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 shadow-blue-500/50 scale-110'
                  : 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-blue-600/40 scale-100'
                  }`}
              >
                <div className="absolute inset-1 rounded-full bg-gradient-to-br from-blue-300/30 to-transparent" />
                <Heart
                  className={`relative z-10 transition-all duration-300 ease-out ${isHovering
                    ? 'h-5 w-5 text-white drop-shadow-lg'
                    : 'h-4 w-4 text-white/90'
                    }`}
                />
                <div
                  className={`absolute inset-0 rounded-full bg-blue-400 transition-all duration-1000 ease-out ${isHovering
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
              {/* Large QR Code Container */}
              <div className="mb-5 px-2">
                <div
                  className="w-full bg-white/5 dark:bg-gray-800/5 rounded-xl p-4 border border-white/20 dark:border-gray-700/20 cursor-pointer hover:scale-[1.02] transition-transform duration-200"
                  onClick={() => openQrModal(qrImageSrc, 'M-Pesa, Airtel Money or Card transactions')}
                >
                  <img
                    src={qrImageSrc}
                    alt="Donation QR Code"
                    className="w-full h-auto object-contain rounded-lg"
                  />
                </div>
              </div>

              {/* Paybill & Account Numbers */}
              <div className="space-y-3 mb-5">
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Paybill Number</div>
                  <button
                    onClick={() => handleCopyDetails(paybillNumber, setCopyStatePaybill)}
                    disabled={copyStatePaybill !== 'default'}
                    className="group relative text-2xl font-mono font-bold text-gray-900 dark:text-white tracking-wider bg-white/10 dark:bg-gray-800/10 inline-flex items-center justify-center min-w-[140px] h-[44px] px-4 rounded-lg hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:bg-white/20 dark:hover:bg-gray-700/30 hover:scale-[1.02] transition-all duration-500 ease-out overflow-hidden"
                  >
                    <div className="relative flex items-center justify-center w-full h-full">
                      <span
                        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${copyStatePaybill === 'default'
                          ? 'opacity-100 scale-100 transform-none group-hover:text-gray-700 dark:group-hover:text-gray-200'
                          : 'opacity-0 scale-90 pointer-events-none'
                          }`}
                      >
                        {paybillNumber}
                      </span>
                      <img
                        src="/icons/loading-2.1-svgrepo-com.svg"
                        className={`absolute h-6 w-6 dark:invert transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${copyStatePaybill === 'loading'
                          ? 'opacity-70 scale-100 animate-spin'
                          : 'opacity-0 scale-50 pointer-events-none'
                          }`}
                        alt="Loading"
                      />
                      <img
                        src="/icons/tick-circle-svgrepo-com.svg"
                        className={`absolute h-7 w-7 dark:invert transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${copyStatePaybill === 'success'
                          ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                          : 'opacity-0 scale-50 pointer-events-none'
                          }`}
                        alt="Success"
                      />
                    </div>
                  </button>
                </div>
                <div className="text-center">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Account Number</div>
                  <button
                    onClick={() => handleCopyDetails(accountNumber, setCopyStateAccount)}
                    disabled={copyStateAccount !== 'default'}
                    className="group relative text-2xl font-mono font-bold text-gray-900 dark:text-white tracking-wider bg-white/10 dark:bg-gray-800/10 inline-flex items-center justify-center min-w-[140px] h-[44px] px-4 rounded-lg hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] hover:bg-white/20 dark:hover:bg-gray-700/30 hover:scale-[1.02] transition-all duration-500 ease-out overflow-hidden"
                  >
                    <div className="relative flex items-center justify-center w-full h-full">
                      <span
                        className={`absolute transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${copyStateAccount === 'default'
                          ? 'opacity-100 scale-100 transform-none group-hover:text-gray-700 dark:group-hover:text-gray-200'
                          : 'opacity-0 scale-90 pointer-events-none'
                          }`}
                      >
                        {accountNumber}
                      </span>
                      <img
                        src="/icons/loading-2.1-svgrepo-com.svg"
                        className={`absolute h-6 w-6 dark:invert transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${copyStateAccount === 'loading'
                          ? 'opacity-70 scale-100 animate-spin'
                          : 'opacity-0 scale-50 pointer-events-none'
                          }`}
                        alt="Loading"
                      />
                      <img
                        src="/icons/tick-circle-svgrepo-com.svg"
                        className={`absolute h-7 w-7 dark:invert transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${copyStateAccount === 'success'
                          ? 'opacity-100 scale-110 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                          : 'opacity-0 scale-50 pointer-events-none'
                          }`}
                        alt="Success"
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Copy Details Button */}
              <button
                onClick={() => handleCopyDetails(`Paybill: ${paybillNumber}, Account: ${accountNumber}`, setCopyStateAll)}
                disabled={copyStateAll !== 'default'}
                className="w-full relative py-2.5 mb-3 rounded-lg font-semibold bg-white/20 dark:bg-gray-800/20 hover:bg-white/30 dark:hover:bg-gray-700/30 text-gray-800 dark:text-gray-200 hover:shadow-[0_0_20px_rgba(0,0,0,0.15)] dark:hover:shadow-[0_0_20px_rgba(255,255,255,0.25)] transition-all duration-500 ease-out backdrop-blur-sm overflow-hidden h-[44px]"
              >
                <div className="relative flex items-center justify-center w-full h-full">
                  <div
                    className={`absolute flex items-center justify-center space-x-2 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${copyStateAll === 'default'
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 scale-90 pointer-events-none'
                      }`}
                  >
                    <img src="/icons/copy-svgrepo-com.svg" className="h-4 w-4 dark:invert opacity-80" alt="Copy" />
                    <span>Copy Details</span>
                  </div>
                  <img
                    src="/icons/loading-2.1-svgrepo-com.svg"
                    className={`absolute h-5 w-5 dark:invert transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${copyStateAll === 'loading'
                      ? 'opacity-80 scale-100 animate-spin'
                      : 'opacity-0 scale-50 pointer-events-none'
                      }`}
                    alt="Loading"
                  />
                  <img
                    src="/icons/tick-circle-svgrepo-com.svg"
                    className={`absolute h-5 w-5 dark:invert transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] ${copyStateAll === 'success'
                      ? 'opacity-100 scale-125 drop-shadow-[0_0_8px_rgba(0,0,0,0.3)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]'
                      : 'opacity-0 scale-50 pointer-events-none'
                      }`}
                    alt="Success"
                  />
                </div>
              </button>

              {/* Close Button */}
              <button
                className="w-full py-2.5 rounded-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 text-white transition-all duration-300 shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] backdrop-blur-sm text-xs"
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
