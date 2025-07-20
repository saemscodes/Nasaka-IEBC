import React from 'react';
import { Shield, Phone, CheckCircle, Scale } from 'lucide-react';

const ModernFooter = () => {
  return (
    <footer className="bg-gradient-to-br from-green-900 to-green-800 text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Recall254</h3>
                <p className="text-green-100 text-sm">Not For GenZ, For Kenya</p>
              </div>
            </div>
            <p className="text-green-100 text-sm leading-relaxed">
              Empowering Kenyan citizens to exercise their constitutional right to recall 
              Members of Parliament through secure, legally compliant digital petitions.
            </p>
          </div>

          {/* Legal Framework */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center">
              <Scale className="w-5 h-5 mr-2" />
              Legal Framework
            </h4>
            <div className="space-y-2 text-sm">
              <a href="#" className="block text-green-100 hover:text-white transition-colors">
                Constitution Article 104
              </a>
              <a href="#" className="block text-green-100 hover:text-white transition-colors">
                KICA §83C (Digital Signatures)
              </a>
              <a href="#" className="block text-green-100 hover:text-white transition-colors">
                Elections Act 2011
              </a>
              <a href="#" className="block text-green-100 hover:text-white transition-colors">
                Katiba Institute Ruling
              </a>
            </div>
          </div>

          {/* Access Methods */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center">
              <Phone className="w-5 h-5 mr-2" />
              Access Methods
            </h4>
            <div className="space-y-3 text-sm">
              <div className="bg-white/10 rounded-lg p-3">
                <h5 className="font-medium text-white mb-1">Web Platform</h5>
                <p className="text-green-100">Full-featured web interface with biometric options</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <h5 className="font-medium text-white mb-1">Mobile Responsive</h5>
                <p className="text-green-100">Optimized for smartphones and tablets</p>
              </div>
            </div>
          </div>

          {/* Compliance & Security */}
          <div className="space-y-4">
            <h4 className="text-lg font-semibold flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Compliance & Security
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-100">KICA §83C Certified</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-100">IEBC API Integration</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-100">End-to-End Encryption</span>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-100">ISO 27001 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-green-700 bg-green-900/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-green-100 text-sm">
              &copy; 2024 Recall254 Platform. Constitutional democracy through digital innovation.
            </p>
            
            {/* Improved link section */}
            <div className="flex items-center space-x-6">
              <a 
                href="/privacy" 
                className="text-green-100 hover:text-white transition-colors text-sm hover:underline underline-offset-4"
              >
                Privacy Policy
              </a>
              <a 
                href="/terms" 
                className="text-green-100 hover:text-white transition-colors text-sm hover:underline underline-offset-4"
              >
                Terms of Service
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default ModernFooter;
