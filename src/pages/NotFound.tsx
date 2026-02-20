import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';
import { Button } from "@/components/ui/button";
import { Sun, Moon, Home, ArrowLeft, AlertTriangle } from 'lucide-react';

import { handle404 } from "@/api/404-message";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);
  const [contextualMessage, setContextualMessage] = useState({ message: "", suggestion: null });

  useEffect(() => {
    // Generate contextual IEBC 404 message
    const ctx = handle404(location.pathname);
    setContextualMessage({
      message: ctx.message,
      suggestion: ctx.bestMatch ? {
        path: ctx.bestMatch,
        label: ctx.bestMatch.split('/').pop() || "Related Page"
      } : null
    });

    // Initialize dark mode
    const savedDarkMode = localStorage.getItem('darkMode');
    const systemDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDarkMode = savedDarkMode ? JSON.parse(savedDarkMode) : systemDarkMode;

    setDarkMode(initialDarkMode);
    if (initialDarkMode) {
      document.documentElement.classList.add('dark');
    }

    // Log error to analytics/service in production
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem('darkMode', JSON.stringify(newDarkMode));

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-green-50/30 to-white'
      }`}>
      <ModernHeader
        darkMode={darkMode}
        toggleDarkMode={toggleDarkMode}
        scrollToTab={() => { }}
      />

      <main className="flex-grow flex items-center justify-center p-4">
        <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl transition-all duration-300 ${darkMode
          ? 'bg-gray-800 border border-gray-700'
          : 'bg-white border border-green-100'
          }`}>
          <div className="text-center mb-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h1 className={`text-6xl font-bold mb-2 transition-colors duration-300 ${darkMode ? 'text-red-400' : 'text-red-600'
              }`}>
              404
            </h1>
            <h2 className={`text-2xl font-semibold mb-2 transition-colors duration-300 ${darkMode ? 'text-gray-200' : 'text-gray-800'
              }`}>
              Page Not Found
            </h2>
            <div className={`mb-6 p-4 rounded-xl text-sm italic leading-relaxed ${darkMode ? 'bg-gray-700/50 text-gray-300' : 'bg-red-50 text-red-700'}`}>
              "{contextualMessage.message}"
            </div>

            {contextualMessage.suggestion && (
              <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Did you mean?</p>
                <Button
                  variant="outline"
                  className="rounded-full border-ios-blue text-ios-blue hover:bg-ios-blue hover:text-white"
                  onClick={() => navigate(contextualMessage.suggestion?.path || "/")}
                >
                  {contextualMessage.suggestion.label}
                </Button>
              </div>
            )}

            <p className={`mb-6 text-xs transition-colors duration-300 ${darkMode ? 'text-gray-500' : 'text-gray-400'
              }`}>
              The path <span className="font-mono">{location.pathname}</span> was not found on our servers.
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={() => navigate(-1)}
              className="w-full flex items-center justify-center gap-2 py-6 text-base"
            >
              <ArrowLeft className="w-5 h-5" />
              Return to Previous Page
            </Button>

            <Button
              asChild
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 py-6 text-base"
            >
              <a href="/">
                <Home className="w-5 h-5" />
                Go to Homepage
              </a>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={toggleDarkMode}
              variant="ghost"
              className={`w-full transition-colors duration-300 ${darkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-green-600 hover:bg-green-50'
                }`}
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  Switch to Light Mode
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 mr-2" />
                  Switch to Dark Mode
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      <ModernFooter />
    </div>
  );
};

export default NotFound;
