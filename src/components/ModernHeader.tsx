
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Menu, X, FileText, Users, Scale, MapPin, Search } from 'lucide-react';

interface ModernHeaderProps {
  darkMode?: boolean;
}

const ModernHeader: React.FC<ModernHeaderProps> = ({ darkMode = false }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // In ModernHeader.tsx
const navigationItems = [
  { 
    id: 'dashboard', 
    label: 'Petitions', 
    icon: FileText
  },
  { 
    id: 'sign', 
    label: 'Sign', 
    icon: Users
  },
  { 
    id: 'legal', 
    label: 'Legal', 
    icon: Scale
  },
  { 
    id: 'map', 
    label: 'Map', 
    icon: MapPin
  },
  { 
    id: 'search', 
    label: 'Search', 
    icon: Search
  }
];
  
  const handleNavigation = (item: typeof navigationItems[0]) => {
  // Dispatch a custom event that the main page can listen for
  const event = new CustomEvent('tab-navigation', { 
    detail: { tabId: item.id } 
  });
  window.dispatchEvent(event);
  setIsMobileMenuOpen(false);
};

  return (
    <header className={`sticky top-0 z-50 transition-all duration-300 ${
      darkMode 
        ? 'bg-gray-900/95 backdrop-blur-sm border-gray-700' 
        : 'bg-white/95 backdrop-blur-sm border-green-100'
    } border-b`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold transition-colors duration-300 ${
                darkMode ? 'text-white' : 'text-green-900'
              }`}>
                Recall254
              </h1>
              <p className={`text-xs transition-colors duration-300 ${
                darkMode ? 'text-gray-400' : 'text-green-600'
              }`}>
                Democratic Accountability
              </p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigationItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                onClick={() => handleNavigation(item)}
                className={`flex items-center space-x-2 transition-colors duration-300 ${
                  darkMode 
                    ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                    : 'text-green-700 hover:text-green-900 hover:bg-green-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-sm">{item.label}</span>
              </Button>
            ))}
          </nav>

          {/* Status Badge */}
          <div className="hidden sm:flex items-center space-x-3">
            <Badge 
              variant="outline" 
              className={`transition-colors duration-300 ${
                darkMode 
                  ? 'border-green-600 text-green-400 bg-green-900/20' 
                  : 'border-green-600 text-green-700 bg-green-50'
              }`}
            >
              Beta
            </Badge>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className={`md:hidden transition-colors duration-300 ${
              darkMode 
                ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                : 'text-green-700 hover:text-green-900 hover:bg-green-50'
            }`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className={`md:hidden py-4 border-t transition-colors duration-300 ${
            darkMode ? 'border-gray-700' : 'border-green-100'
          }`}>
            <nav className="flex flex-col space-y-2">
              {navigationItems.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => handleNavigation(item)}
                  className={`flex items-center space-x-3 justify-start transition-colors duration-300 ${
                    darkMode 
                      ? 'text-gray-300 hover:text-white hover:bg-gray-700' 
                      : 'text-green-700 hover:text-green-900 hover:bg-green-50'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Button>
              ))}
              <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                <Badge 
                  variant="outline" 
                  className={`transition-colors duration-300 ${
                    darkMode 
                      ? 'border-green-600 text-green-400 bg-green-900/20' 
                      : 'border-green-600 text-green-700 bg-green-50'
                  }`}
                >
                  Beta Version
                </Badge>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default ModernHeader;
