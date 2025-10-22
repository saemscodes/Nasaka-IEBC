import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  const { theme } = useTheme();

  const footerVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.3,
        ease: [0.4, 0.0, 0.2, 1]
      }
    }
  };

  const handleSupportClick = (e) => {
    e.preventDefault();
    window.open('https://zenlipa.co.ke/tip/civic-education-kenya', '_blank', 'noopener,noreferrer');
  };

  const handleContactClick = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent('Support Inquiry - Recall254 IEBC Office Finder');
    const body = encodeURIComponent(`Hello Civic Education Kenya team,\n\nI am reaching out regarding the Recall254 platform, which helps Kenyan citizens locate IEBC offices for voter registration and civic participation.\n\n[Please include your question or feedback here]`);
    window.open(`mailto:civiceducationkenya@gmail.com?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
  };

  const handleCekaClick = (e) => {
    e.preventDefault();
    window.open('https://ceka254.vercel.app/', '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.footer
      className={`border-t py-3 px-4 mt-auto transition-all duration-300 ${
        theme === 'dark'
          ? 'bg-ios-gray-900 border-ios-gray-700'
          : 'bg-white border-ios-gray-200'
      }`}
      variants={footerVariants}
      initial="initial"
      animate="animate"
    >
      <div className="max-w-md mx-auto">
        {/* Compact CEKA Branding */}
        <motion.div
          className="mb-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <button
            onClick={handleCekaClick}
            className="flex items-center justify-center space-x-1 mx-auto group"
          >
            {/* Compact Dual Mode Logo */}
            <div className="relative w-5 h-5">
              {theme === 'dark' ? (
                <motion.img 
                  key="dark-logo"
                  src="https://i.imgur.com/9U7p4QQ.png" 
                  alt="CEKA Logo" 
                  className="w-5 h-5 group-hover:scale-110 transition-transform duration-200"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              ) : (
                <motion.img 
                  key="light-logo"
                  src="https://i.imgur.com/xnC1q8e.png" 
                  alt="CEKA Logo" 
                  className="w-5 h-5 group-hover:scale-110 transition-transform duration-200"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                />
              )}
            </div>
            <span className={`font-semibold text-xs tracking-wide group-hover:text-ios-blue transition-colors duration-200 ${
              theme === 'dark' 
                ? 'text-ios-gray-300 group-hover:text-ios-blue-400' 
                : 'text-ios-gray-600 group-hover:text-ios-blue'
            }`}>
              Powered by CEKA
            </span>
          </button>
        </motion.div>

        {/* Compact Support and Contact Links */}
        <div className="flex items-center justify-center space-x-4 mb-2">
          <button
            onClick={handleSupportClick}
            className={`text-xs font-medium hover:opacity-80 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 rounded px-1 py-0.5 ${
              theme === 'dark'
                ? 'text-ios-blue-300 focus:ring-ios-blue-400 focus:ring-offset-ios-gray-900'
                : 'text-ios-blue focus:ring-ios-blue-500 focus:ring-offset-white'
            }`}
          >
            Donate
          </button>
          
          <div className={`w-px h-2 ${
            theme === 'dark' ? 'bg-ios-gray-600' : 'bg-ios-gray-300'
          }`}></div>
          
          <button
            onClick={handleContactClick}
            className={`text-xs font-medium hover:opacity-80 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 rounded px-1 py-0.5 ${
              theme === 'dark'
                ? 'text-ios-blue-300 focus:ring-ios-blue-400 focus:ring-offset-ios-gray-900'
                : 'text-ios-blue focus:ring-ios-blue-500 focus:ring-offset-white'
            }`}
          >
            Contact Us
          </button>
        </div>

        {/* Compact Copyright */}
        <div className={`text-xs text-center ${
          theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'
        }`}>
          © {currentYear} Civic Education Kenya 
        </div>
      </div>
    </motion.footer>
  );
};

export default AppFooter;
