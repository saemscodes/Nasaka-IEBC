
import React, { useState } from 'react';
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
  Phone, 
  Mail, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  QrCode,
  FileText,
  Key,
  Lock
} from 'lucide-react';
import { toast } from "sonner";
import { SignatureFlowService, SignatureFlowData } from '@/utils/signatureFlowService';
import SignatureSuccessModal from './SignatureSuccessModal';
import CryptoStatusCard from './CryptoStatusCard';

interface EnhancedSignatureFlowProps {
  petitionId: string;
  petitionTitle: string;
  onComplete: (receiptCode: string) => void;
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

  const handleSubmit = async () => {
    if (!validateStep(2)) return;

    setIsProcessing(true);
    try {
      console.log('🚀 Initiating cryptographic signature process...');
      
      const result = await SignatureFlowService.processSignature(formData, petitionTitle);
      
      if (result.success && result.signatureId && result.receiptCode && result.qrCode && result.receiptData) {
        console.log('✅ Signature process completed successfully');
        
        setSignatureResult({
          signatureId: result.signatureId,
          receiptCode: result.receiptCode,
          qrCode: result.qrCode,
          receiptData: result.receiptData,
          blockchainHash: result.blockchainHash,
          cryptoSignature: result.cryptoSignature,
          publicKey: result.publicKey,
          deviceId: result.deviceId,
          voterName: formData.voterName,
          voterEmail: formData.voterEmail,
          petitionTitle
        });
        
        setShowSuccessModal(true);
        toast.success('🔐 Petition signed with cryptographic security!');
        onComplete(result.receiptCode);
      } else {
        toast.error(result.error || 'Failed to process signature');
      }
    } catch (error) {
      console.error('Signature submission error:', error);
      toast.error('Failed to submit signature. Please try again.');
    } finally {
      setIsProcessing(false);
    }
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
          <CryptoStatusCard />
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

        <div className="flex items-center justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(3)}>
            Previous
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isProcessing}
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
