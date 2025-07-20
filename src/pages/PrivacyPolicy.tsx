import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ArrowLeft, Shield, Scale, Database, Lock, Users, FileText, AlertCircle } from 'lucide-react';

const PrivacyPolicy = () => {
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
            <Shield className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Privacy Policy</h1>
          </div>
          
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 rounded-full">
              Effective: January 20, 2025
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
              Data Protection Act 2019 Compliant
            </span>
            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full">
              Constitution 2010, Article 31
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Introduction */}
        <div className="mb-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed">
            Recall254 facilitates the constitutional process of Member of Parliament recall under 
            <strong> Article 104 of the Constitution of Kenya 2010</strong>. This policy governs 
            how we collect, use, and protect your personal data in compliance with Kenyan law.
          </p>
        </div>

        {/* Collapsible Sections */}
        <div className="space-y-0">
          <CollapsibleSection
            id="legal-framework"
            title="Legal Framework & Constitutional Basis"
            icon={Scale}
            defaultExpanded={true}
          >
            <p>
              Recall254 operates under Kenyan constitutional authority. Our data processing complies with:
            </p>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mt-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Primary Legal Authorities</h4>
              <ul className="space-y-2">
                <li><strong>Constitution of Kenya 2010, Article 104:</strong> Legal basis for recall of MPs</li>
                <li><strong>Constitution of Kenya 2010, Article 31:</strong> Right to privacy</li>
                <li><strong>Data Protection Act, 2019:</strong> Governs personal data processing</li>
                <li><strong>Elections Act, 2011:</strong> Framework for electoral processes</li>
              </ul>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="data-collection"
            title="Data Collection & Processing"
            icon={Database}
          >
            <p>
              We collect personal data necessary to verify voter eligibility for recall processes:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Personal Information</h4>
                <ul className="space-y-1 text-sm">
                  <li>• Full legal name</li>
                  <li>• National ID/passport number</li>
                  <li>• Mobile phone number</li>
                  <li>• Electoral constituency/ward</li>
                </ul>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Technical Data</h4>
                <ul className="space-y-1 text-sm">
                  <li>• IP address</li>
                  <li>• Device type</li>
                  <li>• Timestamp of interactions</li>
                  <li>• Digital signatures</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="data-security"
            title="Data Security & Protection"
            icon={Lock}
          >
            <p>
              We implement comprehensive security measures meeting international standards:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Encryption</h4>
                <p className="text-sm">AES-256 for data at rest, TLS 1.3 for data in transit</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Access Controls</h4>
                <p className="text-sm">Multi-factor authentication with audit logging</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Data Storage</h4>
                <p className="text-sm">Secure cloud infrastructure with Kenyan data residency</p>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="user-rights"
            title="Your Rights Under Kenyan Law"
            icon={Users}
          >
            <p>
              You have specific rights regarding your personal data:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Constitutional Rights</h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    <h5 className="font-medium text-gray-900 dark:text-white">Right to Privacy</h5>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Protection against unreasonable interference</p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Data Protection Rights</h4>
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    <h5 className="font-medium text-gray-900 dark:text-white">Access & Correction</h5>
                    <p className="text-sm text-gray-700 dark:text-gray-300">Request copies and correction of data</p>
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="data-sharing"
            title="Data Sharing & Disclosure"
            icon={FileText}
          >
            <p>
              We share personal data only as required by law for recall processes:
            </p>

            <div className="mt-6 space-y-4">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-3">Authorized Entities</h4>
                <ul className="space-y-2 text-emerald-800 dark:text-emerald-200 text-sm">
                  <li><strong>IEBC:</strong> For petition verification</li>
                  <li><strong>Office of the AG:</strong> For legal proceedings</li>
                  <li><strong>DCI:</strong> For investigation of electoral fraud</li>
                </ul>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-900 dark:text-red-100 mb-3">Prohibited Recipients</h4>
                <ul className="space-y-1 text-red-800 dark:text-red-200 text-sm">
                  <li>• Political parties or campaigns</li>
                  <li>• Commercial marketing companies</li>
                  <li>• Foreign governments or entities</li>
                </ul>
              </div>
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            id="contact-complaints"
            title="Contact & Complaints"
            icon={Shield}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Recall254 DPO</h4>
                <div className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                  <p><strong>Email:</strong> privacy@recall254.co.ke</p>
                  <p><strong>Phone:</strong> +254-700-732255</p>
                  <p><strong>Response Time:</strong> Within 30 days</p>
                </div>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Data Commissioner</h4>
                <div className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
                  <p><strong>Website:</strong> www.odpc.go.ke</p>
                  <p><strong>Email:</strong> info@odpc.go.ke</p>
                  <p><strong>Phone:</strong> +254-20-2628000</p>
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium">Recall254 Privacy Policy</p>
            <p>Last Updated: January 20, 2025 | Version 2.0</p>
            <p>Governed by Kenyan Law | Disputes subject to Kenyan Courts</p>
            <p className="italic mt-4 text-emerald-700 dark:text-emerald-400">
              "Every person has the right to privacy" - Article 31(a), Constitution of Kenya 2010
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
