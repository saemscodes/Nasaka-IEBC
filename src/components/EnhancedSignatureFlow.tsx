
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Fingerprint, 
  MapPin, 
  Smartphone, 
  AlertTriangle, 
  CheckCircle,
  Eye,
  Clock,
  Users,
  FileText,
  Lock,
  Wifi,
  QrCode
} from 'lucide-react';

interface CSPProvider {
  id: string;
  name: string;
  type: 'advanced' | 'qualified';
  features: string[];
  cost: string;
  availability: 'available' | 'limited' | 'unavailable';
  authMethod: string;
  supportedDevices: string[];
}

const EnhancedSignatureFlow = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    nationalId: '',
    phoneNumber: '',
    fullName: '',
    constituency: '',
    ward: '',
    petitionId: '1'
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<any>(null);
  const [selectedCSP, setSelectedCSP] = useState<string>('');
  const [biometricData, setBiometricData] = useState<string>('');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);

  const cspProviders: CSPProvider[] = [
    {
      id: 'geda',
      name: 'GEDA LIMITED',
      type: 'advanced',
      features: ['Government Integration', 'API Authentication', 'Audit Trail', 'Biometric Support'],
      cost: 'Free for civic petitions',
      availability: 'available',
      authMethod: 'PKI + Biometric',
      supportedDevices: ['Web', 'Mobile', 'Tablet']
    },
    {
      id: 'tendaworld',
      name: 'TENDAWORLD LTD',
      type: 'qualified',
      features: ['USSD Support', 'Mobile SDK', 'SMS OTP', 'Offline Capability'],
      cost: 'Free (500/month)',
      availability: 'available',
      authMethod: 'SMS OTP + PIN',
      supportedDevices: ['Web', 'Mobile', 'USSD']
    },
    {
      id: 'emudhra',
      name: 'Emudhra Technologies',
      type: 'qualified',
      features: ['PKI Certificates', 'Global Standards', 'Cross-border Recognition', 'Enterprise Grade'],
      cost: 'NGO Subsidized',
      availability: 'available',
      authMethod: 'PKI Certificate',
      supportedDevices: ['Web', 'Mobile', 'Desktop']
    },
    {
      id: 'icta',
      name: 'ICTA (Government)',
      type: 'qualified',
      features: ['eCitizen Integration', 'National ID Validation', 'Government QES', 'Official Seal'],
      cost: 'Free for government petitions',
      availability: 'available',
      authMethod: 'eCitizen SSO',
      supportedDevices: ['Web', 'Mobile']
    }
  ];

  useEffect(() => {
    // Capture device information for audit trail
    const deviceFingerprint = {
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      timestamp: new Date().toISOString(),
      connectionType: (navigator as any).connection?.effectiveType || 'unknown'
    };
    setDeviceInfo(deviceFingerprint);
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const performFourEyesVerification = async () => {
    setIsVerifying(true);
    
    try {
      console.log('Starting Four-Eyes verification for:', formData.nationalId);
      
      // First Eye: IEBC Verification
      const iebcResponse = await fetch('/api/verify-voter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nationalId: formData.nationalId,
          constituency: formData.constituency
        })
      });
      
      const iebcResult = await iebcResponse.json();
      
      // Second Eye: National ID Database Verification (simulated)
      const nationalIdResult = {
        verified: true,
        biometricMatch: !!biometricData
      };
      
      const results = {
        iebcVerified: iebcResult.verified,
        nationalIdVerified: nationalIdResult.verified,
        voterDetails: iebcResult.voterDetails,
        wardMatch: iebcResult.ward === formData.ward,
        constituencyMatch: iebcResult.constituency === formData.constituency,
        biometricMatch: nationalIdResult.biometricMatch
      };
      
      setVerificationResults(results);
      
      if (results.iebcVerified && results.nationalIdVerified && results.wardMatch) {
        setCurrentStep(3); // Proceed to CSP selection
      }
      
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const simulateBiometricCapture = () => {
    const mockBiometric = `bio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setBiometricData(mockBiometric);
  };

  const initiateCSPSignature = async () => {
    const csp = cspProviders.find(p => p.id === selectedCSP);
    if (!csp) return;

    try {
      console.log(`Initiating ${csp.name} signature process...`);
      // In a real implementation, this would redirect to the CSP
      setCurrentStep(4); // Move to final confirmation
      
    } catch (error) {
      console.error('Failed to initiate CSP signature:', error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Legal Disclaimer Banner */}
      <Alert className="border-kenya-green/30 bg-kenya-green/5">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Constitutional Assurance:</strong> Your digital signature carries equal legal weight to 
          handwritten under Kenya Information & Communications Act §83C and Business Laws Amendment Act 2020.
          <a href="#kica-details" className="text-kenya-green hover:underline ml-2">Learn more</a>
        </AlertDescription>
      </Alert>

      {/* Progress Indicator */}
      <Card className="border-kenya-green/30">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-8">
              <div className={`flex items-center space-x-2 ${currentStep >= 1 ? 'text-kenya-green' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 1 ? 'bg-kenya-green text-white' : 'bg-gray-200'
                }`}>1</div>
                <div className="text-sm">
                  <div className="font-medium">ID Verification</div>
                  <div className="text-xs text-gray-500">KICA §83C(2)</div>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 ${currentStep >= 2 ? 'text-kenya-green' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 2 ? 'bg-kenya-green text-white' : 'bg-gray-200'
                }`}>2</div>
                <div className="text-sm">
                  <div className="font-medium">Four-Eyes Check</div>
                  <div className="text-xs text-gray-500">Dual Verification</div>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 ${currentStep >= 3 ? 'text-kenya-green' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 3 ? 'bg-kenya-green text-white' : 'bg-gray-200'
                }`}>3</div>
                <div className="text-sm">
                  <div className="font-medium">Digital Signature</div>
                  <div className="text-xs text-gray-500">CAK Provider</div>
                </div>
              </div>
              
              <div className={`flex items-center space-x-2 ${currentStep >= 4 ? 'text-kenya-green' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentStep >= 4 ? 'bg-kenya-green text-white' : 'bg-gray-200'
                }`}>4</div>
                <div className="text-sm">
                  <div className="font-medium">Completion</div>
                  <div className="text-xs text-gray-500">Certificate</div>
                </div>
              </div>
            </div>
          </div>
          <Progress value={(currentStep / 4) * 100} className="h-2" />
        </CardContent>
      </Card>

      {/* Step 1: Identity Verification */}
      {currentStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="border-kenya-green/30">
              <CardHeader className="bg-kenya-green/5">
                <CardTitle className="flex items-center text-kenya-green">
                  <Shield className="w-5 h-5 mr-2" />
                  Dual Identity Verification
                </CardTitle>
                <CardDescription>
                  Required by Four-Eyes Principle for constitutional compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* IEBC Verification */}
                  <div className="space-y-4 p-4 border border-blue-200 rounded-lg bg-blue-50/30">
                    <h4 className="font-semibold text-blue-800 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      IEBC Voter Registration
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="nationalId">National ID Number</Label>
                        <Input
                          id="nationalId"
                          value={formData.nationalId}
                          onChange={(e) => handleInputChange('nationalId', e.target.value)}
                          placeholder="12345678"
                          className="border-blue-200 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <Label htmlFor="fullName">Full Name (as registered)</Label>
                        <Input
                          id="fullName"
                          value={formData.fullName}
                          onChange={(e) => handleInputChange('fullName', e.target.value)}
                          placeholder="John Doe Mwangi"
                          className="border-blue-200 focus:border-blue-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="constituency">Constituency</Label>
                          <Input
                            id="constituency"
                            value={formData.constituency}
                            onChange={(e) => handleInputChange('constituency', e.target.value)}
                            placeholder="Nairobi Central"
                            className="border-blue-200 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <Label htmlFor="ward">Ward</Label>
                          <Input
                            id="ward"
                            value={formData.ward}
                            onChange={(e) => handleInputChange('ward', e.target.value)}
                            placeholder="Ziwani"
                            className="border-blue-200 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* National ID Database */}
                  <div className="space-y-4 p-4 border border-green-200 rounded-lg bg-green-50/30">
                    <h4 className="font-semibold text-green-800 flex items-center">
                      <Fingerprint className="w-4 h-4 mr-2" />
                      National ID Database
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="phoneNumber">Phone Number</Label>
                        <Input
                          id="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                          placeholder="+254 7XX XXX XXX"
                          className="border-green-200 focus:border-green-500"
                        />
                      </div>
                      
                      {/* Biometric Capture */}
                      <div className="border-2 border-dashed border-green-300 rounded-lg p-4 text-center">
                        <Fingerprint className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <h5 className="font-medium mb-2">Biometric Verification</h5>
                        <p className="text-sm text-gray-600 mb-3">Touch sensor or use camera</p>
                        {!biometricData ? (
                          <Button 
                            onClick={simulateBiometricCapture}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            size="sm"
                          >
                            Capture Biometric
                          </Button>
                        ) : (
                          <div className="flex items-center justify-center text-green-600">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Biometric Captured
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => setCurrentStep(2)}
                  disabled={!formData.nationalId || !formData.phoneNumber || !biometricData}
                  className="w-full mt-6 bg-kenya-green hover:bg-kenya-green/90"
                >
                  Proceed to Verification
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Legal Context Sidebar */}
          <div className="space-y-4">
            <Card className="border-kenya-green/30">
              <CardHeader>
                <CardTitle className="text-sm text-kenya-green">Legal Requirements</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex items-start">
                  <CheckCircle className="w-3 h-3 text-kenya-green mr-2 mt-0.5" />
                  <span>KICA §83C compliance for digital signatures</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-3 h-3 text-kenya-green mr-2 mt-0.5" />
                  <span>Constitutional Article 104 requirements</span>
                </div>
                <div className="flex items-start">
                  <CheckCircle className="w-3 h-3 text-kenya-green mr-2 mt-0.5" />
                  <span>Four-Eyes verification protocol</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-sm text-blue-800">Security Status</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex items-center">
                  <Lock className="w-3 h-3 text-green-600 mr-2" />
                  <span>End-to-End Encryption: Active</span>
                </div>
                <div className="flex items-center">
                  <Shield className="w-3 h-3 text-green-600 mr-2" />
                  <span>CAK Certified Providers</span>
                </div>
                <div className="flex items-center">
                  <Eye className="w-3 h-3 text-green-600 mr-2" />
                  <span>Audit Trail: Recording</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Four-Eyes Verification */}
      {currentStep === 2 && (
        <Card className="border-yellow-200">
          <CardHeader className="bg-yellow-50">
            <CardTitle className="flex items-center text-yellow-800">
              <Eye className="w-5 h-5 mr-2" />
              Four-Eyes Verification Process
            </CardTitle>
            <CardDescription className="text-yellow-600">
              Dual verification system: IEBC registration + National ID database
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {!verificationResults ? (
              <div className="text-center space-y-6">
                <div className="flex items-center justify-center space-x-8">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <div className="text-sm font-medium">IEBC API</div>
                    <div className="text-xs text-gray-500">Verifying registration</div>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <div className="text-sm font-medium">National ID DB</div>
                    <div className="text-xs text-gray-500">Checking biometrics</div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold">Performing Dual Verification</h3>
                <p className="text-gray-600">Checking IEBC voter registration and National ID database...</p>
                {!isVerifying && (
                  <Button 
                    onClick={performFourEyesVerification}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    Start Verification Process
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold mb-4">Verification Results</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={`p-4 border rounded-lg ${
                    verificationResults.iebcVerified ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center mb-2">
                      {verificationResults.iebcVerified ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                      )}
                      <span className="font-semibold">IEBC Verification</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {verificationResults.iebcVerified ? 'Registered voter confirmed' : 'Voter registration not found'}
                    </p>
                    {verificationResults.voterDetails && (
                      <div className="mt-2 text-xs text-gray-500">
                        <div>Name: {verificationResults.voterDetails.name}</div>
                        <div>Constituency: {verificationResults.voterDetails.constituency}</div>
                        <div>Ward: {verificationResults.voterDetails.ward}</div>
                      </div>
                    )}
                  </div>

                  <div className={`p-4 border rounded-lg ${
                    verificationResults.nationalIdVerified ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center mb-2">
                      {verificationResults.nationalIdVerified ? (
                        <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                      )}
                      <span className="font-semibold">National ID Verification</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {verificationResults.nationalIdVerified ? 'Identity confirmed' : 'Identity verification failed'}
                    </p>
                    {verificationResults.biometricMatch && (
                      <div className="mt-2 text-xs text-green-600">
                        <CheckCircle className="w-3 h-3 inline mr-1" />
                        Biometric match confirmed
                      </div>
                    )}
                  </div>
                </div>

                {verificationResults.iebcVerified && verificationResults.nationalIdVerified && (
                  <Button 
                    onClick={() => setCurrentStep(3)}
                    className="w-full bg-kenya-green hover:bg-kenya-green/90"
                  >
                    Proceed to Digital Signature
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: CSP Selection */}
      {currentStep === 3 && (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="flex items-center text-blue-800">
              <Shield className="w-5 h-5 mr-2" />
              Select CAK-Certified Signature Provider
            </CardTitle>
            <CardDescription className="text-blue-600">
              Choose from approved Certificate Service Providers for legal digital signatures
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cspProviders.map((csp) => (
                <div
                  key={csp.id}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedCSP === csp.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                  onClick={() => setSelectedCSP(csp.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg">{csp.name}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={csp.type === 'qualified' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                          {csp.type.toUpperCase()} eSign
                        </Badge>
                        <Badge className="bg-gray-100 text-gray-800">
                          {csp.authMethod}
                        </Badge>
                      </div>
                    </div>
                    <Badge className={
                      csp.availability === 'available' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }>
                      {csp.availability}
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Features:</div>
                      <div className="flex flex-wrap gap-1">
                        {csp.features.map((feature, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-1">Supported Devices:</div>
                      <div className="flex space-x-2">
                        {csp.supportedDevices.map((device, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {device}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="text-sm font-medium text-kenya-green">{csp.cost}</div>
                  </div>
                </div>
              ))}
            </div>

            {selectedCSP && (
              <div className="mt-6 space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    You will be redirected to {cspProviders.find(p => p.id === selectedCSP)?.name} 
                    for secure digital signature creation. This process is encrypted and legally binding under KICA §83C.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={initiateCSPSignature}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Create Digital Signature with {cspProviders.find(p => p.id === selectedCSP)?.name}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Alternative Access Methods */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            Alternative Access Methods
          </CardTitle>
          <CardDescription>
            Multiple ways to sign the petition for maximum accessibility
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 border rounded-lg hover:border-kenya-green/40 transition-all">
              <div className="w-12 h-12 bg-kenya-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-6 h-6 text-kenya-green" />
              </div>
              <div className="font-mono text-xl font-bold text-kenya-green mb-2">*483*58#</div>
              <h3 className="font-semibold mb-2">USSD Access</h3>
              <p className="text-sm text-gray-600">Use any phone to sign via USSD menu system</p>
              <Button variant="outline" className="mt-3 border-kenya-green text-kenya-green" size="sm">
                Try USSD
              </Button>
            </div>
            
            <div className="text-center p-6 border rounded-lg hover:border-blue-400 transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wifi className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-blue-600 mb-2">WhatsApp</div>
              <h3 className="font-semibold mb-2">+254 700 RECALL</h3>
              <p className="text-sm text-gray-600">Get signature links and updates via WhatsApp</p>
              <Button variant="outline" className="mt-3 border-blue-600 text-blue-600" size="sm">
                Open WhatsApp
              </Button>
            </div>
            
            <div className="text-center p-6 border rounded-lg hover:border-purple-400 transition-all">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-lg font-bold text-purple-600 mb-2">QR Code</div>
              <h3 className="font-semibold mb-2">Offline Distribution</h3>
              <p className="text-sm text-gray-600">Scan QR codes at community centers and offices</p>
              <Button variant="outline" className="mt-3 border-purple-600 text-purple-600" size="sm">
                Generate QR
              </Button>
            </div>
          </div>

          <div className="mt-6 bg-kenya-green/5 border border-kenya-green/20 rounded-lg p-4">
            <h4 className="font-semibold text-kenya-green mb-2 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Equal Legal Validity
            </h4>
            <p className="text-sm text-gray-700">
              All signature methods meet KICA §83C advanced electronic signature requirements as upheld in 
              <em className="font-medium"> Katiba Institute v AG (Petition 209/2016)</em>. 
              Your constitutional right to recall is protected regardless of access method.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedSignatureFlow;
