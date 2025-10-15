import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';

const AppFooter = () => {
  const currentYear = new Date().getFullYear();
  const { theme } = useTheme();

  // Entrance animation for footer
  const footerVariants = {
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: [0.4, 0.0, 0.2, 1] }
    }
  };

  // Spring config used for hover pop/bounce
  const hoverSpring = {
    type: 'spring',
    stiffness: 350,
    damping: 22
  };

  // Click handlers
  const handleSupportClick = (e) => {
    e.preventDefault();
    window.open(
      'https://zenlipa.co.ke/tip/civic-education-kenya',
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleContactClick = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent('Support Inquiry - Recall254 IEBC Office Finder');
    const body = encodeURIComponent(
      `Hello Civic Education Kenya team,\n\nI am reaching out regarding the Recall254 platform, which helps Kenyan citizens locate IEBC offices for voter registration and civic participation.\n\n[Please include your question or feedback here]`
    );
    window.open(`mailto:civiceducationkenya@gmail.com?subject=${subject}&body=${body}`, '_blank', 'noopener,noreferrer');
  };

  const handleCekaClick = (e) => {
    e.preventDefault();
    window.open('https://ceka254.vercel.app/', '_blank', 'noopener,noreferrer');
  };

  // Theme-aware class helpers for link affordance (clear clickable colors & transitions)
  const cekaTextClasses = [
    'font-semibold',
    'text-xs',
    'tracking-wide',
    'transition-colors',
    'duration-200'
  ].join(' ');

  const cekaTextThemeClasses =
    theme === 'dark'
      ? 'text-ios-gray-300 group-hover:text-ios-blue-300'
      : 'text-ios-gray-600 group-hover:text-ios-blue-600';

  const linkBaseClasses = [
    'text-xs',
    'font-medium',
    'transition-colors',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-1',
    'rounded',
    'px-1',
    'py-0.5'
  ].join(' ');

  const supportLinkThemeClasses =
    theme === 'dark'
      ? 'text-ios-blue-300 focus:ring-ios-blue-400 focus:ring-offset-ios-gray-900 hover:text-ios-blue-200'
      : 'text-ios-blue focus:ring-ios-blue-500 focus:ring-offset-white hover:text-ios-blue-700';

  const contactLinkThemeClasses = supportLinkThemeClasses;

  const footerBgClasses =
    theme === 'dark' ? 'bg-ios-gray-900 border-ios-gray-700' : 'bg-white border-ios-gray-200';

  const dividerClasses = theme === 'dark' ? 'bg-ios-gray-600' : 'bg-ios-gray-300';

  return (
    <motion.footer
      className={`border-t py-3 px-4 mt-auto transition-all duration-300 ${footerBgClasses}`}
      variants={footerVariants}
      initial="initial"
      animate="animate"
      aria-labelledby="footer-heading"
    >
      <div className="max-w-md mx-auto">
        {/* Compact CEKA Branding */}
        <motion.div
          className="mb-2"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.button
            onClick={handleCekaClick}
            className="flex items-center justify-center space-x-2 mx-auto group"
            aria-label="Open CEKA homepage"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.985 }}
            transition={hoverSpring}
          >
            {/* Compact Dual Mode Logo */}
            <motion.div
              className="relative w-5 h-5"
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              {theme === 'dark' ? (
                <motion.img
                  key="dark-logo"
                  src="https://i.imgur.com/9U7p4QQ.png"
                  alt="CEKA Logo"
                  className="w-5 h-5 rounded-sm"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  draggable={false}
                />
              ) : (
                <motion.img
                  key="light-logo"
                  src="https://i.imgur.com/xnC1q8e.png"
                  alt="CEKA Logo"
                  className="w-5 h-5 rounded-sm"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  draggable={false}
                />
              )}
            </motion.div>

            <motion.span
              className={`${cekaTextClasses} ${cekaTextThemeClasses}`}
              aria-hidden="false"
            >
              Powered by CEKA
            </motion.span>
          </motion.button>
        </motion.div>

        {/* Compact Support and Contact Links */}
        <div className="flex items-center justify-center space-x-4 mb-2">
          <motion.button
            onClick={handleSupportClick}
            className={`group ${linkBaseClasses} ${supportLinkThemeClasses}`}
            whileHover={{ scale: 1.025, y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={hoverSpring}
            aria-label="Support or donate to Civic Education Kenya"
          >
            <span className="pointer-events-none">Support/Donations</span>
          </motion.button>

          <div
            className={`w-px h-2 ${dividerClasses}`}
            aria-hidden="true"
          />

          <motion.button
            onClick={handleContactClick}
            className={`group ${linkBaseClasses} ${contactLinkThemeClasses}`}
            whileHover={{ scale: 1.025, y: -1 }}
            whileTap={{ scale: 0.985 }}
            transition={hoverSpring}
            aria-label="Contact Civic Education Kenya via email"
          >
            <span className="pointer-events-none">Contact Us</span>
          </motion.button>
        </div>

        {/* Compact Copyright */}
        <div
          className={`text-xs text-center transition-colors duration-200 ${
            theme === 'dark' ? 'text-ios-gray-500' : 'text-ios-gray-400'
          }`}
        >
          © {currentYear} Civic Education Kenya
        </div>
      </div>
    </motion.footer>
  );
};

export default AppFooter;
