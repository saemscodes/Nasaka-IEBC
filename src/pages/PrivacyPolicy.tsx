
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Scale, FileText, Users, Database, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ModernHeader from '@/components/ModernHeader';
import ModernFooter from '@/components/ModernFooter';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <ModernHeader 
        darkMode={false} 
        toggleDarkMode={() => {}} 
        scrollToTab={() => {}} 
      />
      
      <div className="container mx-auto px-4 py-8">
        <Button 
          onClick={() => navigate('/')} 
          variant="ghost" 
          className="mb-6 text-blue-700 dark:text-blue-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
              <CardTitle className="flex items-center text-2xl text-blue-900 dark:text-blue-100">
                <Shield className="w-6 h-6 mr-3" />
                Privacy Policy
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm">
                <Badge variant="outline" className="border-blue-300 text-blue-700">
                  Effective: January 1, 2024
                </Badge>
                <Badge variant="outline" className="border-green-300 text-green-700">
                  KICA §83C Compliant
                </Badge>
                <Badge variant="outline" className="border-purple-300 text-purple-700">
                  Constitution 2010
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="prose prose-blue dark:prose-invert max-w-none">
                <h3 className="flex items-center text-xl font-semibold text-blue-900 dark:text-blue-100">
                  <Scale className="w-5 h-5 mr-2" />
                  Legal Framework & Constitutional Basis
                </h3>
                <p className="text-gray-700 dark:text-gray-300">
                  This privacy policy governs the Katiba Recall Platform ("Platform"), developed in accordance with 
                  Article 104 of the Constitution of Kenya 2010, which provides for the recall of Members of Parliament. 
                  Our data processing practices comply with:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-gray-700 dark:text-gray-300">
                  <li><strong>Kenya Information and Communications Act (KICA), Section 83C</strong> - Digital signature standards</li>
                  <li><strong>Data Protection Act, 2019</strong> - Personal data protection requirements</li>
                  <li><strong>Computer Misuse and Cybercrimes Act, 2018</strong> - Cybersecurity provisions</li>
                  <li><strong>Access to Information Act, 2016</strong> - Information access rights</li>
                  <li><strong>Constitution of Kenya 2010, Articles 31-35</strong> - Privacy and information rights</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="bg-green-50 dark:bg-green-900/20">
              <CardTitle className="flex items-center text-green-900 dark:text-green-100">
                <Database className="w-5 h-5 mr-2" />
                Data Collection & Processing
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Personal Data Collected</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>• Full legal name (as per identification document)</li>
                    <li>• National ID, Passport, or other government-issued ID number</li>
                    <li>• Phone number for verification</li>
                    <li>• Electoral constituency and ward</li>
                    <li>• Polling station (where applicable)</li>
                    <li>• Email address (optional)</li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Technical Data Collected</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>• Digital signature certificates (CAK-licensed CSP)</li>
                    <li>• Device fingerprints for security</li>
                    <li>• IP addresses and geolocation data</li>
                    <li>• Browser and device information</li>
                    <li>• Timestamp and audit trail data</li>
                    <li>• QR receipt codes and verification tokens</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="bg-purple-50 dark:bg-purple-900/20">
              <CardTitle className="flex items-center text-purple-900 dark:text-purple-100">
                <Lock className="w-5 h-5 mr-2" />
                Data Security & Encryption
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-4 rounded-lg">
                <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  KICA Section 83C Compliance
                </h4>
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  All digital signatures are created using Communications Authority of Kenya (CAK) licensed 
                  Certification Service Providers (CSPs) with end-to-end encryption meeting ISO 27001 standards.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h5 className="font-semibold mb-2">Data at Rest</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    AES-256 encryption with rotating keys stored in secure hardware modules
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h5 className="font-semibold mb-2">Data in Transit</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    TLS 1.3 encryption for all communications with certificate pinning
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h5 className="font-semibold mb-2">Access Control</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Multi-factor authentication and role-based access with audit logging
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="bg-red-50 dark:bg-red-900/20">
              <CardTitle className="flex items-center text-red-900 dark:text-red-100">
                <Users className="w-5 h-5 mr-2" />
                Your Rights Under Kenyan Law
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3">Constitutional Rights (Article 31)</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>• Right to privacy and protection of personal information</li>
                    <li>• Right to access information held by the state</li>
                    <li>• Right to correction of false or misleading information</li>
                    <li>• Right to reasonable compensation for interference</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-red-800 dark:text-red-200 mb-3">Data Protection Act Rights</h4>
                  <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <li>• Right to be informed about data processing</li>
                    <li>• Right to access your personal data</li>
                    <li>• Right to rectification of inaccurate data</li>
                    <li>• Right to erasure (with legal limitations)</li>
                    <li>• Right to restrict processing</li>
                    <li>• Right to data portability</li>
                  </ul>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  Important Legal Limitations
                </h4>
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Article 104 Requirements:</strong> Once a petition signature is verified and becomes part 
                  of an official recall process, certain data cannot be deleted or modified to maintain the integrity 
                  of the democratic process. However, personal identifiers may be anonymized while preserving 
                  verification capabilities.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 dark:border-orange-800">
            <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
              <CardTitle className="flex items-center text-orange-900 dark:text-orange-100">
                <FileText className="w-5 h-5 mr-2" />
                Data Sharing & Third Parties
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                    Authorized Government Entities
                  </h4>
                  <ul className="text-sm text-orange-800 dark:text-orange-200 space-y-1">
                    <li>• <strong>Independent Electoral and Boundaries Commission (IEBC)</strong> - For petition verification</li>
                    <li>• <strong>Office of the Attorney General</strong> - For legal proceedings</li>
                    <li>• <strong>Directorate of Criminal Investigations (DCI)</strong> - For fraud investigation</li>
                    <li>• <strong>Ethics and Anti-Corruption Commission (EACC)</strong> - For integrity verification</li>
                  </ul>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-semibold mb-2">Technical Service Providers</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    <li>• CAK-licensed Certification Service Providers (CSPs) for digital signatures</li>
                    <li>• Secure cloud infrastructure providers (with data residency in Kenya)</li>
                    <li>• Audit and compliance verification services</li>
                  </ul>
                </div>

                <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
                  <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                    We Do NOT Share Data With:
                  </h4>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    <li>• Political parties or campaigns</li>
                    <li>• Commercial marketing companies</li>
                    <li>• Social media platforms</li>
                    <li>• Foreign governments or entities</li>
                    <li>• Non-governmental organizations (unless legally required)</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Contact & Complaints</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Platform Data Protection Officer</h4>
                  <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <p>Email: privacy@katibarecall.ke</p>
                    <p>Phone: +254-700-KATIBA</p>
                    <p>Physical Address: Nairobi, Kenya</p>
                    <p>Response Time: 30 days maximum</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Office of the Data Protection Commissioner</h4>
                  <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                    <p>Website: www.odpc.go.ke</p>
                    <p>Email: info@odpc.go.ke</p>
                    <p>Phone: +254-20-2628000</p>
                    <p>For formal complaints and appeals</p>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                <p>
                  This privacy policy was last updated on January 18, 2025, and is subject to Kenyan law. 
                  Any disputes will be resolved in the courts of Kenya.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <ModernFooter />
    </div>
  );
};

export default PrivacyPolicy;
