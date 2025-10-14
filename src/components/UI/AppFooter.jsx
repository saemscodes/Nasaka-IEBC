import React from 'react';
import { motion } from 'framer-motion';

const AppFooter = () => {
  const currentYear = new Date().getFullYear();

  const footerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
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
      className="bg-white dark:bg-ios-gray-900 border-t border-ios-gray-200 dark:border-ios-gray-700 py-6 px-6 mt-auto"
      variants={footerVariants}
      initial="initial"
      animate="animate"
    >
      <div className="max-w-md mx-auto text-center">
        {/* CEKA Branding */}
        <motion.div
          className="mb-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <button
            onClick={handleCekaClick}
            className="flex items-center justify-center space-x-2 mx-auto group"
          >
            {/* Mini CEKA Logo - Dual mode with direct Imgur links */}
            <div className="relative">
              {/* Colored logo for light mode */}
              <img 
                src="https://i.imgur.com/xnC1q8e.png" 
                alt="CEKA Logo" 
                className="w-6 h-6 group-hover:scale-110 transition-transform duration-200 block dark:hidden"
              />
              {/* White logo for dark mode */}
              <img 
                src="https://i.imgur.com/9U7p4QQ.png" 
                alt="CEKA Logo" 
                className="w-6 h-6 group-hover:scale-110 transition-transform duration-200 hidden dark:block"
              />
            </div>
            <span className="text-ios-gray-600 dark:text-ios-gray-300 font-semibold text-sm tracking-wide group-hover:text-ios-blue transition-colors duration-200">
              Powered by CEKA
            </span>
          </button>
        </motion.div>

        {/* Support and Contact Links */}
        <div className="flex items-center justify-center space-x-6 mb-4">
          <button
            onClick={handleSupportClick}
            className="text-ios-blue dark:text-ios-blue-300 text-xs font-medium hover:text-ios-blue/80 dark:hover:text-ios-blue-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:ring-offset-1 dark:focus:ring-offset-ios-gray-900 rounded-lg px-2 py-1"
          >
            Support/Donations
          </button>
          
          <div className="w-px h-3 bg-ios-gray-300 dark:bg-ios-gray-600"></div>
          
          <button
            onClick={handleContactClick}
            className="text-ios-blue dark:text-ios-blue-300 text-xs font-medium hover:text-ios-blue/80 dark:hover:text-ios-blue-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ios-blue/50 focus:ring-offset-1 dark:focus:ring-offset-ios-gray-900 rounded-lg px-2 py-1"
          >
            Contact Us
          </button>
        </div>

        {/* Copyright */}
        <div className="text-ios-gray-400 dark:text-ios-gray-500 text-xs">
          © {currentYear} Recall254. Civic Education Kenya.
        </div>
      </div>
    </motion.footer>
  );
};

export default AppFooter;