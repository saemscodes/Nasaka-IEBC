
import React from 'react';
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';
import QRVerificationPage from '@/components/QRVerificationPage';

const VerifySignature = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800">
      <ModernHeader darkMode={false} toggleDarkMode={() => {}} scrollToTab={() => {}} />
      <div className="pt-16">
        <QRVerificationPage />
      </div>
      <ModernFooter />
    </div>
  );
};

export default VerifySignature;
