import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, ArrowLeft, Search, MapPin, AlertTriangle, ExternalLink, Sun, Moon } from 'lucide-react';
import { handle404 } from '@/api/404-message';
import { SEOHead } from '@/components/SEO/SEOHead';

const SUPPORT_EMAIL = 'contact@civiceducationkenya.com';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const [message, setMessage] = useState<string>("We couldn't find the page you were looking for.");
  const [loading, setLoading] = useState<boolean>(true);
  const [bestMatch, setBestMatch] = useState<string | null>(null);
  const [messageWithLinks, setMessageWithLinks] = useState<React.ReactNode>('');

  const goBack = useCallback(() => {
    if (window.history.length > 3) {
      navigate(-1);
    } else {
      navigate('/');
    }
  }, [navigate]);

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    `404 encountered: ${pathname}`
  )}&body=${encodeURIComponent(
    `Hello CEKA Support,\n\nI ran into a 404 error while visiting:\n\n${window.location.href}\n\nDetails:\n- Path: ${pathname}\n- Referrer: ${document.referrer || 'N/A'}\n- User Agent: ${navigator.userAgent}\n- Time (local): ${new Date().toLocaleString()}\n\nI was trying to: [please describe what you were doing]\n\nThank you,\n[Your Name]`
  )}`;

  useEffect(() => {
    const process404 = async () => {
      try {
        const result = await handle404(
          pathname,
          search,
          document.referrer || '',
          navigator.userAgent
        );
        setMessage(result.message);
        setBestMatch(result.bestMatch);

        if (result.bestMatch && result.message.includes(result.bestMatch)) {
          const parts = result.message.split(result.bestMatch);
          const withLink = (
            <>
              {parts[0]}
              <Link
                to={result.bestMatch}
                className={`underline transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
                  }`}
              >
                {result.bestMatch}
              </Link>
              {parts[1]}
            </>
          );
          setMessageWithLinks(withLink);
        } else {
          setMessageWithLinks(result.message);
        }
      } catch (error) {
        console.error('Failed to process 404:', error);
        const errorMessage = `We couldn't find the page ${pathname}. Try using our map to find IEBC offices.`;
        setMessage(errorMessage);
        setMessageWithLinks(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    process404();
  }, [pathname, search, isDark]);

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-6 transition-colors duration-500 ${isDark
          ? 'bg-[hsl(var(--background))]'
          : 'bg-gradient-to-br from-green-50/30 to-white'
        }`}
    >
      <SEOHead
        title="Page Not Found — Nasaka IEBC"
        description="The page you're looking for doesn't exist. Use our interactive map to find IEBC offices across Kenya."
        noIndex
      />

      <motion.section
        aria-labelledby="notfound-title"
        className={`max-w-md w-full p-8 rounded-3xl border text-center transition-all duration-300 ${isDark
            ? 'bg-[hsl(var(--card))] border-[hsl(var(--border))] shadow-ios-high-dark'
            : 'bg-white border-gray-100 shadow-ios-high'
          }`}
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        role="article"
      >
        {/* Nasaka Logo */}
        <motion.header
          className="mb-6"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-blue-500/15' : 'bg-blue-50'
            }`}>
            <img
              src={isDark ? '/nasaka-logo-white.png' : '/nasaka-logo-blue.png'}
              alt="Nasaka IEBC"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        </motion.header>

        {/* 404 Badge */}
        <div className="relative mb-4">
          <motion.div
            aria-hidden="true"
            className={`text-8xl font-black select-none ${isDark ? 'text-red-500/10' : 'text-red-400/15'
              }`}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: 'spring' }}
          >
            404
          </motion.div>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4">
            <h1
              id="notfound-title"
              className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'
                }`}
            >
              Page Not Found
            </h1>
          </div>
        </div>

        {/* Dynamic Message */}
        <AnimatePresence mode="wait">
          <motion.div
            key={loading ? 'loading' : 'message'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
          >
            {loading ? (
              <span className="animate-pulse">Searching constituencies...</span>
            ) : (
              messageWithLinks
            )}
          </motion.div>
        </AnimatePresence>

        {/* Path Badge */}
        <p
          className={`text-[11px] font-mono select-all break-all mb-6 text-center px-3 py-2 rounded-xl ${isDark ? 'text-gray-500 bg-gray-800/50' : 'text-gray-400 bg-gray-50'
            }`}
        >
          {pathname}
        </p>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            onClick={goBack}
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-sm border transition-all duration-300 ${isDark
                ? 'text-gray-200 border-gray-700 bg-gray-800 hover:bg-gray-700'
                : 'text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <Link
            to="/"
            className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm text-white transition-all duration-300 ${isDark
                ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25'
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-400/25'
              }`}
            aria-label="Go home"
          >
            <Home className="h-4 w-4" />
            Home
          </Link>
        </div>

        {/* Secondary nav: Map & Help */}
        <div className="flex justify-center gap-4 mb-6">
          <Link
            to="/iebc-office/map"
            className={`flex items-center gap-1.5 text-sm transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-500 hover:text-blue-600'
              }`}
          >
            <MapPin className="h-4 w-4" />
            Find IEBC Office
          </Link>
          <a
            href={mailtoHref}
            className={`flex items-center gap-1.5 text-sm transition-colors ${isDark ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-600'
              }`}
          >
            <ExternalLink className="h-4 w-4" />
            Report Issue
          </a>
        </div>

        {/* Theme Toggle + Footer */}
        <div className={`pt-4 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
          <button
            onClick={toggleTheme}
            className={`mx-auto flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 ${isDark
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-500 hover:bg-gray-100'
              }`}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>

        <p className={`text-[10px] mt-4 ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>
          © {new Date().getFullYear()} Civic Education Kenya (CEKA)
        </p>
      </motion.section>
    </div>
  );
};

export default NotFound;
