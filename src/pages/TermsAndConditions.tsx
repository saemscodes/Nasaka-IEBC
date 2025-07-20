import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft, Scale, Gavel, AlertTriangle, Shield, Users, FileText } from 'lucide-react';

const TermsAndConditions = () => {
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const CollapsibleSection = ({ id, title, icon: Icon, children, defaultExpanded = false }) => {
    const isExpanded = expandedSections[id] ?? defaultExpanded;
    
    return (
      <div className="border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between py-6 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200"
        >
          <div className="flex items-center space-x-3">
            <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h2>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        {isExpanded && (
          <div className="pb-6 pl-8 text-gray-700 dark:text-gray-300 leading-relaxed space-y-4">
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button 
            onClick={() => window.history.back()}
            className="flex items-center text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 mb-6 font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Recall254
          </button>
          
          <div className="flex items-center space-x-4 mb-4">
            <Scale className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terms and Conditions</h1>
          </div>
          
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-full">
              Effective: January 20, 2025
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
              Article 104 Compliance
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
              Elections Act 2011
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Introduction */}
        <div className="mb-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
            These Terms govern your use of Recall254, facilitating the constitutional process of MP recall under 
            <strong> Article 104 of the Constitution of Kenya 2010</strong>. By using this platform, 
            you agree to these terms and Kenyan law.
          </p>
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-0">
          <CollapsibleSection
            id="constitutional-framework"
            title="Constitutional Framework & Authority"
            icon={Gavel}
            defaultExpanded={true}
          >
            <p>
              Recall254 operates under constitutional authority granted by Article 104:
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Legal Authorities</h4>
              <ul className="space-y-2">
                <li><strong>Article 104:</strong> Recall of Members of Parliament</li>
                <li><strong>Elections Act, 2011:</strong> Procedures for recall petitions</li>
                <li><strong>Constitution Article 1(3):</strong> Sovereignty of the people</li>
              </ul>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="eligibility-requirements"
            title="Legal Requirements & Eligibility"
            icon={AlertTriangle}
          >
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-3">Signer Requirements</h4>
              <ul className="space-y-2 text-emerald-800 dark:text-emerald-200">
                <li>✓ Registered voter in the constituency</li>
                <li>✓ Kenyan citizen aged 18+ years</li>
                <li>✓ Valid government-issued ID</li>
                <li>✓ Not disqualified under Chapter 6</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Prohibited Actions</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Signing on behalf of others</li>
                  <li>• Providing false information</li>
                  <li>• Multiple signatures per petition</li>
                </ul>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Required Documentation</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Valid National ID/Passport</li>
                  <li>• Voter registration details</li>
                  <li>• Accurate constituency info</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="digital-signatures"
            title="Digital Signature Standards"
            icon={Shield}
          >
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Legal Compliance</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Digital signatures comply with Kenya Information and Communications Act Section 83C 
                using CAK-licensed Certification Service Providers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Signature Validity</h5>
                <p className="text-xs text-gray-600 dark:text-gray-400">Legally equivalent to handwritten signatures</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Non-Repudiation</h5>
                <p className="text-xs text-gray-600 dark:text-gray-400">Cannot deny signing once verified</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Audit Trail</h5>
                <p className="text-xs text-gray-600 dark:text-gray-400">All activities logged for legal proceedings</p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="rights-responsibilities"
            title="Rights and Responsibilities"
            icon={Users}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Your Rights</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>• Constitutional right to petition</li>
                  <li>• Privacy protection</li>
                  <li>• Verification receipt</li>
                  <li>• Data access and correction</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Your Responsibilities</h4>
                <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                  <li>• Provide truthful information</li>
                  <li>• Sign each petition only once</li>
                  <li>• Understand recall grounds</li>
                  <li>• Follow electoral laws</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                Legal Consequences
              </h4>
              <div className="text-red-800 dark:text-red-200 space-y-2 text-sm">
                <p><strong>Electoral Fraud:</strong> Up to 2 years imprisonment or KES 200,000 fine</p>
                <p><strong>Computer Misuse:</strong> Up to 3 years imprisonment or KES 5M fine</p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="platform-usage"
            title="Platform Usage"
            icon={FileText}
          >
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Service Availability</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Platform operates 24/7 but may experience downtime for maintenance. We aim for 99.9% uptime.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Acceptable Use</h5>
                <ul className="space-y-1 text-sm">
                  <li>• Legitimate petition signing</li>
                  <li>• Signature verification</li>
                  <li>• Accessing public information</li>
                </ul>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-3">Prohibited Use</h5>
                <ul className="space-y-1 text-sm">
                  <li>• Automated signature generation</li>
                  <li>• Unauthorized system access</li>
                  <li>• Spreading false information</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="jurisdiction"
            title="Legal Jurisdiction"
            icon={Scale}
          >
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Governing Law</h4>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                These Terms are governed by Kenyan Law. Disputes will be resolved in Kenyan Courts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Constitutional Disputes</h5>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Matters relating to Article 104 will be heard by the High Court.
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Dispute Resolution</h5>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Mediation through recognized mechanisms before court proceedings.
                </p>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium">Recall254 Terms and Conditions</p>
            <p>Last Updated: January 20, 2025 | Version 2.0</p>
            <p>Legal Notices: legal@recall254.co.ke | Support: support@recall254.co.ke</p>
            <p className="italic mt-4 text-emerald-700 dark:text-emerald-400">
              "The sovereignty of the people shall be exercised in accordance with this Constitution" 
              - Article 1(3), Constitution of Kenya 2010
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsAndConditions;
