// src/components/Common/SuccessNotification.js
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const SuccessNotification = ({ 
  isVisible, 
  title, 
  message, 
  onClose,
  type = 'success',
  autoHideDuration = 5000 
}) => {
  React.useEffect(() => {
    if (isVisible && autoHideDuration) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, autoHideDuration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -100, scale: 0.9 }}
        className="fixed top-4 right-4 z-[var(--z-index-max)] max-w-sm w-full"
      >
        <div className={`${getBackgroundColor()} text-white rounded-xl shadow-2xl p-4`}>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">
                {title}
              </p>
              {message && (
                <p className="text-white text-opacity-90 text-sm mt-1">
                  {message}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-white hover:text-white text-opacity-80 hover:text-opacity-100 transition-colors p-1 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

// Global notification manager
class NotificationManager {
  constructor() {
    this.listeners = [];
    this.currentNotification = null;
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  showNotification(notification) {
    this.currentNotification = notification;
    this.listeners.forEach(listener => listener(notification));
  }

  hideNotification() {
    this.currentNotification = null;
    this.listeners.forEach(listener => listener(null));
  }
}

export const notificationManager = new NotificationManager();

// Global function for showing notifications
if (typeof window !== 'undefined') {
  window.showSuccessNotification = (title, message) => {
    notificationManager.showNotification({
      type: 'success',
      title,
      message,
      isVisible: true
    });
  };

  window.showErrorNotification = (title, message) => {
    notificationManager.showNotification({
      type: 'error',
      title,
      message,
      isVisible: true
    });
  };
}

export default SuccessNotification;
