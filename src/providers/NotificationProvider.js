// src/providers/NotificationProvider.js
import React, { useState, useEffect } from 'react';
import SuccessNotification, { notificationManager } from '@/components/Common/SuccessNotification';

const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const unsubscribe = notificationManager.subscribe((newNotification) => {
      setNotification(newNotification);
    });

    return unsubscribe;
  }, []);

  const handleCloseNotification = () => {
    setNotification(null);
    notificationManager.hideNotification();
  };

  return (
    <>
      {children}
      
      <SuccessNotification
        isVisible={notification?.isVisible || false}
        title={notification?.title}
        message={notification?.message}
        type={notification?.type}
        onClose={handleCloseNotification}
      />
    </>
  );
};

export default NotificationProvider;
