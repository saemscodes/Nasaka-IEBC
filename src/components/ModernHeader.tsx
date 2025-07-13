
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Shield, Menu, X, Users, Search, FileText, MapPin, Scale } from 'lucide-react';

interface ModernHeaderProps {
  darkMode?: boolean;
}

const ModernHeader = ({ darkMode = false }: ModernHeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleNavClick = (tabId: string) => {
    // Dispatch custom event to change active tab
    window.dispatchEvent(new CustomEvent('changeTab', { detail: tabId }));
    setIsMenuOpen(false);
  };

  return (
    <header className={`${darkMode ? 'bg-gray-800/90' : 'bg-white/90'} backdrop-blur-md border-b ${darkMode ? 'border-gray-700' : 'border-green-100'} sticky top-0 z-50`}>
      {/* Constitutional Banner */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white text-xs py-1">
        <div className="container mx-auto px-4 flex justify-center items-center space-x-6">
          <span>Art. 104: Constitutional Right to Recall</span>
          <span>•</span>
          <span>KICA §83C Compliant</span>
          <span>•</span>
          <span>End-to-End Encrypted</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-green-900'}`}>Recall254</h1>
              <p className={`text-xs ${darkMode ? 'text-gray-300' : 'text-green-600'}`}>Not For GenZ, For Kenya</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            <button 
              onClick={() => handleNavClick('dashboard')}
              className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-1`}
            >
              <Users className="w-4 h-4" />
              <span>Active Petitions</span>
            </button>
            <button 
              onClick={() => handleNavClick('search')}
              className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-1`}
            >
              <Search className="w-4 h-4" />
              <span>Search Wards</span>
            </button>
            <button 
              onClick={() => handleNavClick('sign')}
              className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-1`}
            >
              <FileText className="w-4 h-4" />
              <span>Sign Petition</span>
            </button>
            <button 
              onClick={() => handleNavClick('legal')}
              className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-1`}
            >
              <Scale className="w-4 h-4" />
              <span>Legal Framework</span>
            </button>
            <button 
              onClick={() => handleNavClick('map')}
              className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-1`}
            >
              <MapPin className="w-4 h-4" />
              <span>Electoral Map</span>
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className={`md:hidden mt-4 pt-4 border-t ${darkMode ? 'border-gray-700' : 'border-green-100'}`}>
            <div className="flex flex-col space-y-3">
              <button 
                onClick={() => handleNavClick('dashboard')}
                className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-2 text-left`}
              >
                <Users className="w-4 h-4" />
                <span>Active Petitions</span>
              </button>
              <button 
                onClick={() => handleNavClick('search')}
                className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-2 text-left`}
              >
                <Search className="w-4 h-4" />
                <span>Search Wards</span>
              </button>
              <button 
                onClick={() => handleNavClick('sign')}
                className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-2 text-left`}
              >
                <FileText className="w-4 h-4" />
                <span>Sign Petition</span>
              </button>
              <button 
                onClick={() => handleNavClick('legal')}
                className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-2 text-left`}
              >
                <Scale className="w-4 h-4" />
                <span>Legal Framework</span>
              </button>
              <button 
                onClick={() => handleNavClick('map')}
                className={`${darkMode ? 'text-gray-300 hover:text-white' : 'text-green-800 hover:text-green-600'} transition-colors flex items-center space-x-2 text-left`}
              >
                <MapPin className="w-4 h-4" />
                <span>Electoral Map</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default ModernHeader;
