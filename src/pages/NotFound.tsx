import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';
import { Button } from "@/components/ui/button";
import { Sun, Moon, Home, ArrowLeft, AlertTriangle } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
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
    <div className={`min-h-screen flex flex-col transition-colors duration-300 ${
      darkMode ? 'dark bg-gray-900' : 'bg-gradient-to-br from-green-50/30 to-white'
    }`}>
      <ModernHeader darkMode={darkMode} />
      
      <main className="flex-grow flex items-center justify-center p-4">
        <div className={`max-w-md w-full p-8 rounded-2xl shadow-xl transition-all duration-300 ${
          darkMode 
            ? 'bg-gray-800 border border-gray-700' 
            : 'bg-white border border-green-100'
        }`}>
          <div className="text-center mb-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-10 h-10 text-red-600 dark:text-red-400" />
            </div>
            <h1 className={`text-6xl font-bold mb-2 transition-colors duration-300 ${
              darkMode ? 'text-red-400' : 'text-red-600'
            }`}>
              404
            </h1>
            <h2 className={`text-2xl font-semibold mb-2 transition-colors duration-300 ${
              darkMode ? 'text-gray-200' : 'text-gray-800'
            }`}>
              Page Not Found
            </h2>
            <p className={`mb-6 transition-colors duration-300 ${
              darkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              We couldn't find the page at{' '}
              <span className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {location.pathname}
              </span>
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
              className={`w-full transition-colors duration-300 ${
                darkMode 
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
