import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  User, 
  MapPin, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  QrCode,
  FileText,
  Key,
  Lock,
  Download,
  RotateCw
} from 'lucide-react';
import { toast } from "sonner";
import SignatureSuccessModal from './SignatureSuccessModal';
import CryptoStatusCard from './CryptoStatusCard';
import { 
  generateKeyPair, 
  signPetitionData, 
  getKeyInfo, 
  recoverKeys,
  checkCryptoSupport,
  generateKeyBackup,
  downloadKeyBackup,
  validateKeyConsistency
} from '@/utils/cryptoService';
import { supabase } from "@/integrations/supabase/client";

interface EnhancedSignatureFlowProps {
  petitionId: string;
  petitionTitle: string;
  onComplete: (receiptCode: string) => void;
}

interface SignatureFlowData {
  petitionId: string;
  voterName: string;
  voterPhone: string;
  voterId: string;
  constituency: string;
  ward: string;
  pollingStation: string;
  voterEmail: string;
}

const EnhancedSignatureFlow: React.FC<EnhancedSignatureFlowProps> = ({
  petitionId,
  petitionTitle,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [signatureResult, setSignatureResult] = useState<any>(null);
  const [keysReady, setKeysReady] = useState(false);
  const [cryptoSupported, setCryptoSupported] = useState(true);
  const [keyError, setKeyError] = useState('');
  
  const [formData, setFormData] = useState<SignatureFlowData>({
    petitionId,
    voterName: '',
    voterPhone: '',
    voterId: '',
    constituency: '',
    ward: '',
    pollingStation: '',
    voterEmail: ''
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check crypto support on mount
    const support = checkCryptoSupport();
    setCryptoSupported(support.supported);
    
    if (!support.supported) {
      toast.error(`Security features unavailable: ${support.reason}`);
      return;
    }
    
    // Check if keys exist
    const checkKeys = async () => {
      try {
        const { hasKeys } = await getKeyInfo();
        setKeysReady(hasKeys);
      } catch (error) {
        console.error('Key check error:', error);
      }
    };
    
    checkKeys();
  }, []);

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.voterName.trim()) errors.voterName = 'Full name is required';
      if (!formData.voterId.trim()) errors.voterId = 'National ID/Passport is required';
      if (!formData.voterPhone.trim()) errors.voterPhone = 'Phone number is required';
      if (formData.voterPhone && !/^(?:\+254|0)[17]\d{8}$/.test(formData.voterPhone)) {
        errors.voterPhone = 'Invalid Kenyan phone number format';
      }
    }

    if (step === 2) {
      if (!formData.constituency.trim()) errors.constituency = 'Constituency is required';
      if (!formData.ward.trim()) errors.ward = 'Ward is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof SignatureFlowData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const initializeKeys = async () => {
    try {
      const passphrase = await securePrompt('Create a security passphrase');
      const confirmPassphrase = await securePrompt('Confirm your passphrase');
      
       if (passphrase.length < 8) {
      throw new Error('PASSPHRASE_TOO_SHORT');
    }
      
      await generateKeyPair(passphrase);
      setKeysReady(true);
      toast.success('Security keys successfully created');
    } catch (error) {
      console.error('Key initialization failed:', error);
      toast.error('Failed to initialize security keys');
    }
  };

  const handleKeyRecovery = async () => {
    try {
      const oldPassphrase = await securePrompt('Enter your old passphrase');
      const newPassphrase = await securePrompt('Enter a new security passphrase');
      
      const success = await recoverKeys(oldPassphrase, newPassphrase);
      if (success) {
        setKeysReady(true);
        toast.success('Keys successfully recovered!');
      }
    } catch (error) {
      console.error('Key recovery failed:', error);
      toast.error('Key recovery failed. Please try again.');
    }
  };

  const handleSubmit = async () => {
  if (!validateStep(2)) return;

  setIsProcessing(true);

  try {
    console.log('🚀 Starting signature processing with crypto integration');
    
    const { data: existingSignatures, error: existingError } = await supabase
      .from('signatures')
      .select('id')
      .eq('petition_id', petitionId)
      .eq('voter_id', formData.voterId)
      .select('*', { head: true, count: 'exact' });

    if (existingError) throw existingError;
    if (existingSignatures && existingSignatures.length > 0) {
      throw new Error('You have already signed this petition');
    }

    console.log('🔐 Generating cryptographic signature...');
    const signature = await signPetitionData(
      { petitionId, petitionTitle },
      formData
    );

    const verification = await verifySignatureLocally(signature);
    if (!verification.isValid) {
      throw new Error('Local verification failed');
    }

    const { data: signatureRecord, error } = await supabase
      .from('signatures')
      .insert({
        petition_id: petitionId,
        voter_id: formData.voterId,
        voter_name: formData.voterName,
        constituency: formData.constituency,
        ward: formData.ward,
        polling_station: formData.pollingStation,
        signature_payload: signature.payload,
        signature_value: signature.signature,
        public_key: signature.publicKeyJwk,
        key_version: signature.keyVersion,
        device_id: signature.deviceId,
        verification_status: {
          verified: true,
          method: 'digital_signature',
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (error) throw error;

    const receiptCode = `RC-${Date.now().toString(36).toUpperCase()}`;

    setSignatureResult({
      signatureId: signatureRecord.id,
      receiptCode,
      voterName: formData.voterName,
      voterEmail: formData.voterEmail,
      petitionTitle,
      signatureData: signature
    });

    setShowSuccessModal(true);
    toast.success('🔐 Petition signed with cryptographic security!');
    onComplete(receiptCode);

  } catch (error: any) {
    console.error('Signature submission error:', error);

    if (error.message === 'KEY_DERIVATION_FAILED') {
      toast.error(
        <div className="max-w-md">
          <p className="font-medium">Security Key Mismatch</p>
          <p className="text-sm mt-1">This usually happens when:</p>
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>Browser storage was partially cleared</li>
            <li>You're using a different security context</li>
            <li>Device identification changed</li>
          </ul>
          <div className="mt-3 flex space-x-2">
            <Button 
              size="sm"
              onClick={async () => {
                await clearCryptoData();
                await generateKeyPair();
                handleSubmit();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset Keys & Retry
            </Button>
          </div>
        </div>
      );
    } else if (error.message === 'USER_CANCELLED_PASSPHRASE') {
      toast.info('Signing cancelled - passphrase required');
    } else {
      toast.error(`Signature failed: ${error.message}`);
    }

  } finally {
    setIsProcessing(false);
  }
};


const securePrompt = (message: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
      align-items: center; justify-content: center;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
      background: white; padding: 20px; border-radius: 8px;
      width: 300px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    const label = document.createElement('p');
    label.textContent = message;
    label.style.marginBottom = '10px';
    label.style.fontWeight = '500';
    
    const input = document.createElement('input');
    input.type = 'password';
    input.style.cssText = `
      width: 100%; padding: 10px; margin-bottom: 15px;
      border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
    `;

    const button = document.createElement('button');
    button.textContent = 'Submit';
    button.style.cssText = `
      padding: 8px 15px; background: #15803d; color: white;
      border: none; border-radius: 4px; cursor: pointer; font-weight: 500;
    `;

    const timeout = setTimeout(() => {
      document.body.removeChild(modal);
      reject(new Error('PROMPT_TIMEOUT'));
    }, 120000); // 2-minute timeout

    const cleanup = () => {
      clearTimeout(timeout);
      document.body.removeChild(modal);
    };

    button.addEventListener('click', () => {
      if (input.value.trim()) {
        cleanup();
        resolve(input.value);
      }
    });

    // Handle Enter key press
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        if (input.value.trim()) {
          cleanup();
          resolve(input.value);
        }
      }
    });

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(button);
    modal.appendChild(container);
    document.body.appendChild(modal);
    input.focus();
  });
};

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-6">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
            ${currentStep >= step 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }
          `}>
            {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
          </div>
          {step < 4 && (
            <div className={`w-16 h-1 mx-2 ${
              currentStep > step ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-green-900 dark:text-green-100">
          <User className="w-5 h-5 mr-2" />
          Personal Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="voterName">Full Legal Name *</Label>
          <Input
            id="voterName"
            value={formData.voterName}
            onChange={(e) => handleInputChange('voterName', e.target.value)}
            placeholder="As shown on your National ID"
            className={validationErrors.voterName ? 'border-red-500' : ''}
          />
          {validationErrors.voterName && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.voterName}</p>
          )}
        </div>

        <div>
          <Label htmlFor="voterId">National ID / Passport Number *</Label>
          <Input
            id="voterId"
            value={formData.voterId}
            onChange={(e) => handleInputChange('voterId', e.target.value)}
            placeholder="Enter your ID number"
            className={validationErrors.voterId ? 'border-red-500' : ''}
          />
          {validationErrors.voterId && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.voterId}</p>
          )}
        </div>

        <div>
          <Label htmlFor="voterPhone">Phone Number *</Label>
          <Input
            id="voterPhone"
            value={formData.voterPhone}
            onChange={(e) => handleInputChange('voterPhone', e.target.value)}
            placeholder="+254700000000 or 0700000000"
            className={validationErrors.voterPhone ? 'border-red-500' : ''}
          />
          {validationErrors.voterPhone && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.voterPhone}</p>
          )}
        </div>

        <div>
          <Label htmlFor="voterEmail">Email Address (Optional)</Label>
          <Input
            id="voterEmail"
            type="email"
            value={formData.voterEmail}
            onChange={(e) => handleInputChange('voterEmail', e.target.value)}
            placeholder="your.email@example.com"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <Shield className="w-4 h-4" />
            <span>KICA §83C Compliant</span>
          </div>
          <Button onClick={handleNext} className="bg-green-600 hover:bg-green-700">
            Next Step
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-green-900 dark:text-green-100">
          <MapPin className="w-5 h-5 mr-2" />
          Electoral Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="constituency">Constituency *</Label>
          <Input
            id="constituency"
            value={formData.constituency}
            onChange={(e) => handleInputChange('constituency', e.target.value)}
            placeholder="Your electoral constituency"
            className={validationErrors.constituency ? 'border-red-500' : ''}
          />
          {validationErrors.constituency && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.constituency}</p>
          )}
        </div>

        <div>
          <Label htmlFor="ward">Ward *</Label>
          <Input
            id="ward"
            value={formData.ward}
            onChange={(e) => handleInputChange('ward', e.target.value)}
            placeholder="Your electoral ward"
            className={validationErrors.ward ? 'border-red-500' : ''}
          />
          {validationErrors.ward && (
            <p className="text-red-500 text-sm mt-1">{validationErrors.ward}</p>
          )}
        </div>

        <div>
          <Label htmlFor="pollingStation">Polling Station (Optional)</Label>
          <Input
            id="pollingStation"
            value={formData.pollingStation}
            onChange={(e) => handleInputChange('pollingStation', e.target.value)}
            placeholder="Your polling station name"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            Previous
          </Button>
          <Button onClick={handleNext} className="bg-green-600 hover:bg-green-700">
            Security Check
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-blue-900 dark:text-blue-100">
            <Key className="w-5 h-5 mr-2" />
            Cryptographic Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CryptoStatusCard 
            keysReady={keysReady} 
            onInitialize={initializeKeys}
            onRecover={handleKeyRecovery}
            keyError={keyError}
            onSign={() => handleSubmit(true)} // Pass signing handler
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          Previous
        </Button>
        <Button onClick={handleNext} className="bg-green-600 hover:bg-green-700">
          Review & Sign
        </Button>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-green-900 dark:text-green-100">
          <FileText className="w-5 h-5 mr-2" />
          Review & Confirm Cryptographic Signature
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">Petition Summary</h4>
          <p className="text-blue-800 dark:text-blue-200">{petitionTitle}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Signer Details</Label>
            <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <p><strong>Name:</strong> {formData.voterName}</p>
              <p><strong>ID:</strong> {formData.voterId}</p>
              <p><strong>Phone:</strong> {formData.voterPhone}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Electoral Details</Label>
            <div className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
              <p><strong>Constituency:</strong> {formData.constituency}</p>
              <p><strong>Ward:</strong> {formData.ward}</p>
              {formData.pollingStation && (
                <p><strong>Polling Station:</strong> {formData.pollingStation}</p>
              )}
            </div>
          </div>
        </div>

        <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20">
          <Lock className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Enhanced Security</strong> - Your signature will be protected with:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>ECDSA-P384 cryptographic signature</li>
              <li>Blockchain-level hashing</li>
              <li>QR code receipt with verification</li>
              <li>Tamper-proof audit trail</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">Legal Declaration</p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                By proceeding, you confirm that all information provided is accurate and truthful. 
                Your cryptographic signature will create a legally binding digital record under KICA §83C.
              </p>
            </div>
          </div>
        </div>

        {!keysReady && (
          <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Security Keys Not Initialized</strong> - You must set up cryptographic keys before signing.
              <div className="mt-2 flex space-x-2">
                <Button 
                  size="sm"
                  onClick={initializeKeys}
                >
                  <Key className="mr-2 h-4 w-4" />
                  Create Keys
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleKeyRecovery}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  Recover Keys
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(3)}>
            Previous
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing || !keysReady}
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Cryptographic Signature...
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 mr-2" />
                Sign with Cryptography
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  if (!cryptoSupported) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader className="bg-red-100 dark:bg-red-900/30 rounded-t-lg">
          <CardTitle className="flex items-center text-red-700 dark:text-red-200">
            <AlertCircle className="w-6 h-6 mr-2" />
            Security Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <p className="text-red-600 dark:text-red-300">
              Your browser does not support required security features for digital signatures.
            </p>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                Recommended Actions:
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-yellow-700 dark:text-yellow-300">
                <li>Update to the latest browser version</li>
                <li>Use Chrome, Firefox, Edge, or Safari</li>
                <li>Enable JavaScript and IndexedDB</li>
                <li>Check browser security settings</li>
              </ul>
            </div>
            
            <Button 
              className="w-full mt-4"
              onClick={() => window.location.reload()}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Check Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Enhanced Digital Petition Signature
          </h2>
          <Progress value={(currentStep / 4) * 100} className="w-full max-w-md mx-auto" />
          <div className="flex items-center justify-center mt-2 space-x-2">
            <Shield className="w-4 h-4 text-green-600" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Secured with cryptographic signatures
            </span>
          </div>
        </div>

        {renderStepIndicator()}

        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
      </div>

      {signatureResult && (
        <SignatureSuccessModal
          isOpen={showSuccessModal}
          onClose={() => {
            setShowSuccessModal(false);
            setSignatureResult(null);
          }}
          signatureData={signatureResult}
        />
      )}
    </>
  );
};

export default EnhancedSignatureFlow;
