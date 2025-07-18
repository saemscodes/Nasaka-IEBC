
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Scale, Gavel, AlertTriangle, Shield, Users, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';

const TermsAndConditions = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-white dark:from-gray-900 dark:to-gray-800">
      <ModernHeader 
        darkMode={false} 
        toggleDarkMode={() => {}} 
        scrollToTab={() => {}} 
      />
      
      <div className="container mx-auto px-4 py-8">
        <Button 
          onClick={() => navigate('/')} 
          variant="ghost" 
          className="mb-6 text-red-700 dark:text-red-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
              <CardTitle className="flex items-center text-2xl text-red-900 dark:text-red-100">
                <Scale className="w-6 h-6 mr-3" />
                Terms and Conditions
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm">
                <Badge variant="outline" className="border-red-300 text-red-700">
                  Effective: January 1, 2024
                </Badge>
                <Badge variant="outline" className="border-blue-300 text-blue-700">
                  Article 104 Compliance
                </Badge>
                <Badge variant="outline" className="border-green-300 text-green-700">
                  IEBC Standards
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="prose prose-red dark:prose-invert max-w-none">
                <h3 className="flex items-center text-xl font-semibold text-red-900 dark:text-red-100">
                  <Gavel className="w-5 h-5 mr-2" />
                  Constitutional Framework & Legal Authority
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  These Terms and Conditions govern your use of the Katiba Recall Platform ("Platform"), 
                  which operates under the constitutional authority of <strong>Article 104 of the Constitution 
                  of Kenya 2010</strong>. By using this Platform, you acknowledge your understanding of and 
                  compliance with Kenyan law, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                  <li><strong>Constitution of Kenya 2010, Article 104</strong> - Recall of Members of Parliament</li>
                  <li><strong>Elections Act, 2011</strong> - Electoral processes and procedures</li>
                  <li><strong>Kenya Information and Communications Act</strong> - Digital signature standards</li>
                  <li><strong>Penal Code, Chapter 63</strong> - Electoral offenses and penalties</li>
                  <li><strong>Computer Misuse and Cybercrimes Act, 2018</strong> - Digital fraud prevention</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 dark:border-yellow-800">
            <CardHeader className="bg-yellow-50 dark:bg-yellow-900/20">
              <CardTitle className="flex items-center text-yellow-900 dark:text-yellow-100">
                <AlertTriangle className="w-5 h-5 mr-2" />
                Legal Requirements & Eligibility
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-lg border border-yellow-300 dark:border-yellow-700">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  Constitutional Requirements for Petition Signers
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                  Under Article 104(1) and the Elections Act, you MUST meet ALL of the following criteria:
                </p>
                <ul className="space-y-2 text-sm text-yellow-800 dark:text-yellow-200">
                  <li>✓ Be a registered voter in the constituency of the MP being recalled</li>
                  <li>✓ Be a Kenyan citizen aged 18 years or above</li>
                  <li>✓ Possess valid identification (National ID, Passport, or other government-issued ID)</li>
                  <li>✓ Not be disqualified from voting under Chapter 6 (Leadership and Integrity)</li>
                  <li>✓ Provide accurate, truthful information that can be verified</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">Prohibited Actions</h4>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    <li>• Signing on behalf of another person</li>
                    <li>• Providing false identification information</li>
                    <li>• Signing multiple times for the same petition</li>
                    <li>• Using fraudulent or expired documents</li>
                    <li>• Coercing others to sign or not sign</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Required Documentation</h4>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Valid National ID or Passport</li>
                    <li>• Voter registration confirmation</li>
                    <li>• Accurate constituency/ward details</li>
                    <li>• Contact information for verification</li>
                    <li>• Digital signature certificate (auto-generated)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center text-green-900 dark:text-green-100">
                <Shield className="w-5 h-5 mr-2" />
                Digital Signature Standards & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-lg">
                <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  KICA Section 83C Compliance
                </h4>
                <p className="text-sm text-green-800 dark:text-green-200">
                  All digital signatures created on this Platform comply with the Kenya Information and 
                  Communications Act (KICA) Section 83C and are generated using Communications Authority 
                  of Kenya (CAK) licensed Certification Service Providers (CSPs).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Signature Validity</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Digital signatures are legally equivalent to handwritten signatures under Kenyan law
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Non-Repudiation</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    You cannot deny signing once your digital signature is verified and recorded
                  </p>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h5 className="font-semibold mb-2 text-gray-900 dark:text-white">Audit Trail</h5>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    All signature activities are logged and auditable for legal proceedings
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
              <CardTitle className="flex items-center text-purple-900 dark:text-purple-100">
                <Users className="w-5 h-5 mr-2" />
                Rights and Responsibilities
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3">Your Rights</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>• <strong>Constitutional Right (Article 104):</strong> To petition for MP recall</li>
                    <li>• <strong>Privacy Protection:</strong> Personal data encryption and security</li>
                    <li>• <strong>Verification Receipt:</strong> QR code receipt for signature verification</li>
                    <li>• <strong>Data Access:</strong> View and verify your petition signatures</li>
                    <li>• <strong>Legal Protection:</strong> Anonymous participation in democratic process</li>
                    <li>• <strong>Appeal Process:</strong> Challenge signature verification decisions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-3">Your Responsibilities</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>• <strong>Truthful Information:</strong> Provide accurate personal details</li>
                    <li>• <strong>Single Signature:</strong> Sign each petition only once</li>
                    <li>• <strong>Informed Decision:</strong> Understand the grounds for recall</li>
                    <li>• <strong>Legal Compliance:</strong> Follow all electoral laws</li>
                    <li>• <strong>Secure Access:</strong> Protect your verification codes</li>
                    <li>• <strong>Reporting:</strong> Report suspicious or fraudulent activity</li>
                  </ul>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                  ⚠️ Legal Consequences of Violation
                </h4>
                <div className="text-sm text-red-800 dark:text-red-200 space-y-2">
                  <p><strong>Electoral Fraud (Penal Code, Section 109):</strong> Up to 2 years imprisonment or fine up to KES 200,000</p>
                  <p><strong>Computer Misuse (CMCA 2018, Section 17):</strong> Up to 3 years imprisonment or fine up to KES 5,000,000</p>
                  <p><strong>False Information (Section 23):</strong> Up to 2 years imprisonment or fine up to KES 5,000,000</p>
                  <p><strong>Identity Fraud:</strong> Criminal charges under multiple acts with cumulative penalties</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
              <CardTitle className="flex items-center text-orange-900 dark:text-orange-100">
                <FileText className="w-5 h-5 mr-2" />
                Platform Usage & Limitations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">Service Availability</h4>
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    The Platform operates 24/7 but may experience downtime for maintenance, security updates, 
                    or due to circumstances beyond our control. We aim for 99.9% uptime but do not guarantee 
                    continuous availability, especially during periods of high traffic or system maintenance.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h5 className="font-semibold mb-2">Acceptable Use</h5>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>✓ Legitimate petition signing</li>
                      <li>✓ Verification of your own signatures</li>
                      <li>✓ Accessing public petition information</li>
                      <li>✓ Downloading your QR receipts</li>
                    </ul>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h5 className="font-semibold mb-2">Prohibited Use</h5>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <li>✗ Automated signature generation</li>
                      <li>✗ System hacking or unauthorized access</li>
                      <li>✗ Spreading false information</li>
                      <li>✗ Interfering with other users</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Legal Jurisdiction & Dispute Resolution</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Governing Law</h4>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  These Terms and Conditions are governed by the <strong>Laws of Kenya</strong>. Any disputes 
                  arising from the use of this Platform will be subject to the exclusive jurisdiction of the 
                  <strong>Courts of Kenya</strong>, with the High Court of Kenya having primary jurisdiction 
                  for constitutional matters under Article 104.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h5 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Constitutional Disputes</h5>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Matters relating to Article 104 implementation, electoral processes, or constitutional 
                    interpretation will be heard by the High Court Constitutional Division.
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <h5 className="font-semibold text-green-900 dark:text-green-100 mb-2">Alternative Dispute Resolution</h5>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Before court proceedings, parties may engage in mediation through the Kenya National 
                    Council for Law Reporting or other recognized ADR mechanisms.
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  <strong>Platform Contact Information</strong>
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Legal Notices: legal@katibarecall.ke | Technical Support: support@katibarecall.ke
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Last Updated: January 18, 2025 | Version 1.0 | Next Review: July 2025
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              "The sovereignty of the people of Kenya shall be exercised in accordance with this Constitution" 
              - Article 1(3), Constitution of Kenya 2010
            </p>
          </div>
        </div>
      </div>
      
      <ModernFooter />
    </div>
  );
};

export default TermsAndConditions;
